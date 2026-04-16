#!/usr/bin/env node

/**
 * Task CLI - A command-line task manager application
 * CSE 310 - Applied Programming - JavaScript Module
 * 
 * This application manages tasks with persistent storage using JSON files.
 * All operations are performed via command-line arguments.
 * 
 * Usage:
 *   node task.js add "Task description"
 *   node task.js list
 *   node task.js list completed
 *   node task.js list pending
 *   node task.js complete <id>
 *   node task.js delete <id>
 *   node task.js help
 * 
 * @author Your Name
 * @version 1.0.0
 * @date 2026-04-16
 */

const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');

// ============================================
// CONSTANTS
// ============================================

const TASKS_FILE = path.join(__dirname, 'tasks.json');
const VALID_STATUSES = ['pending', 'completed', 'in-progress'];

// Simple colors for console output
const COLORS = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m'
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function colorPrint(message, color = 'reset') {
    console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

function showError(message) {
    colorPrint(`❌ Error: ${message}`, 'red');
}

function showSuccess(message) {
    colorPrint(`✓ ${message}`, 'green');
}

function showWarning(message) {
    colorPrint(`⚠️ ${message}`, 'yellow');
}

function showInfo(message) {
    colorPrint(`ℹ️ ${message}`, 'cyan');
}

function formatDate(isoDate) {
    if (!isoDate) return 'N/A';
    const date = new Date(isoDate);
    return date.toLocaleString();
}

function createReadlineInterface() {
    return readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
}

async function askConfirmation(question) {
    const rl = createReadlineInterface();
    return new Promise((resolve) => {
        rl.question(`${question} (y/N): `, (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
        });
    });
}

function isValidId(id) {
    return !isNaN(id) && id > 0 && Number.isInteger(parseFloat(id));
}

// ============================================
// TASK CLASS
// ============================================

class Task {
    constructor(id, description, status = 'pending', createdAt = null) {
        this.id = id;
        this.description = description;
        this.status = status;
        this.createdAt = createdAt || new Date().toISOString();
        this.updatedAt = new Date().toISOString();
    }

    toJSON() {
        return {
            id: this.id,
            description: this.description,
            status: this.status,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }

    static fromJSON(json) {
        const task = new Task(json.id, json.description, json.status, json.createdAt);
        task.updatedAt = json.updatedAt;
        return task;
    }

    complete() {
        this.status = 'completed';
        this.updatedAt = new Date().toISOString();
    }

    startProgress() {
        this.status = 'in-progress';
        this.updatedAt = new Date().toISOString();
    }

    isCompleted() {
        return this.status === 'completed';
    }

    getStatusEmoji() {
        switch (this.status) {
            case 'completed': return '✅';
            case 'in-progress': return '🔄';
            default: return '⏳';
        }
    }
}

// ============================================
// TASK MANAGER CLASS
// ============================================

class TaskManager {
    constructor() {
        this.tasks = [];
        this.nextId = 1;
        this.initialized = false;
    }

    async initialize() {
        if (!this.initialized) {
            await this.loadTasks();
            this.initialized = true;
        }
    }

    async loadTasks() {
        try {
            await fs.access(TASKS_FILE);
            const data = await fs.readFile(TASKS_FILE, 'utf8');
            const tasksData = JSON.parse(data);
            
            this.tasks = tasksData.map(taskData => Task.fromJSON(taskData));
            
            if (this.tasks.length > 0) {
                this.nextId = Math.max(...this.tasks.map(t => t.id)) + 1;
            } else {
                this.nextId = 1;
            }
            
            return true;
        } catch (error) {
            if (error.code === 'ENOENT') {
                this.tasks = [];
                this.nextId = 1;
                await this.saveTasks();
                return true;
            } else if (error instanceof SyntaxError) {
                showError('Tasks file is corrupted. Starting with empty task list.');
                this.tasks = [];
                this.nextId = 1;
                await this.saveTasks();
                return true;
            }
            throw error;
        }
    }

    async saveTasks() {
        try {
            const tasksData = this.tasks.map(task => task.toJSON());
            const data = JSON.stringify(tasksData, null, 2);
            await fs.writeFile(TASKS_FILE, data, 'utf8');
        } catch (error) {
            throw new Error(`Failed to save tasks: ${error.message}`);
        }
    }

    async addTask(description) {
        if (!description || description.trim() === '') {
            throw new Error('Task description cannot be empty');
        }
        
        if (description.length > 500) {
            throw new Error('Task description is too long (max 500 characters)');
        }
        
        const task = new Task(this.nextId, description.trim());
        this.tasks.push(task);
        this.nextId++;
        
        await this.saveTasks();
        
        return task;
    }

    listTasks(filter = null) {
        let filteredTasks = this.tasks;
        
        if (filter && VALID_STATUSES.includes(filter)) {
            filteredTasks = this.tasks.filter(task => task.status === filter);
        }
        
        return filteredTasks;
    }

    displayTasks(filter = null) {
        const tasks = this.listTasks(filter);
        
        if (tasks.length === 0) {
            const filterMsg = filter ? `${filter} ` : '';
            showInfo(`No ${filterMsg}tasks found.`);
            return;
        }
        
        console.log('\n' + '='.repeat(80));
        const header = filter ? `${filter.toUpperCase()} TASKS` : 'ALL TASKS';
        colorPrint(`📋 ${header} (${tasks.length} total)`, 'bright');
        console.log('='.repeat(80));
        
        tasks.forEach(task => {
            const statusColor = task.isCompleted() ? 'green' : (task.status === 'in-progress' ? 'yellow' : 'white');
            const emoji = task.getStatusEmoji();
            
            console.log(`\n${emoji} ${COLORS.bright}[${task.id}]${COLORS.reset} ${task.description}`);
            colorPrint(`   Status: ${task.status}`, statusColor);
            console.log(`   Created: ${formatDate(task.createdAt)}`);
            console.log(`   Updated: ${formatDate(task.updatedAt)}`);
            console.log('-'.repeat(80));
        });
    }

    async completeTask(id) {
        if (!isValidId(id)) {
            throw new Error('Invalid task ID. Please provide a positive number.');
        }
        
        const task = this.tasks.find(t => t.id === id);
        if (!task) {
            const availableIds = this.tasks.map(t => t.id).join(', ');
            throw new Error(`Task with ID ${id} not found. Available IDs: ${availableIds || 'none'}`);
        }
        
        if (task.isCompleted()) {
            showWarning(`Task ${id} is already completed.`);
            return task;
        }
        
        task.complete();
        await this.saveTasks();
        
        return task;
    }

    async deleteTask(id, skipConfirmation = false) {
        if (!isValidId(id)) {
            throw new Error('Invalid task ID. Please provide a positive number.');
        }
        
        const index = this.tasks.findIndex(t => t.id === id);
        if (index === -1) {
            throw new Error(`Task with ID ${id} not found.`);
        }
        
        const task = this.tasks[index];
        
        if (!skipConfirmation) {
            const confirmed = await askConfirmation(`Are you sure you want to delete task ${id}: "${task.description}"?`);
            if (!confirmed) {
                showInfo('Delete cancelled.');
                return false;
            }
        }
        
        this.tasks.splice(index, 1);
        await this.saveTasks();
        
        return true;
    }

    getStats() {
        const total = this.tasks.length;
        const completed = this.tasks.filter(t => t.isCompleted()).length;
        const inProgress = this.tasks.filter(t => t.status === 'in-progress').length;
        const pending = this.tasks.filter(t => t.status === 'pending').length;
        
        return { total, completed, inProgress, pending };
    }

    displayStats() {
        const stats = this.getStats();
        
        console.log('\n' + '='.repeat(50));
        colorPrint('📊 TASK STATISTICS', 'bright');
        console.log('='.repeat(50));
        colorPrint(`Total Tasks: ${stats.total}`, 'white');
        colorPrint(`✅ Completed: ${stats.completed}`, 'green');
        colorPrint(`🔄 In Progress: ${stats.inProgress}`, 'yellow');
        colorPrint(`⏳ Pending: ${stats.pending}`, 'cyan');
        console.log('='.repeat(50) + '\n');
    }
}

// ============================================
// COMMAND HANDLERS
// ============================================

function showHelp() {
    console.log(`
${COLORS.bright}${COLORS.cyan}Task CLI - Task Manager Application${COLORS.reset}
${'='.repeat(60)}

${COLORS.bright}USAGE:${COLORS.reset}
  node task.js <command> [arguments]

${COLORS.bright}COMMANDS:${COLORS.reset}
  ${COLORS.green}add${COLORS.reset} <description>     Add a new task
  ${COLORS.green}list${COLORS.reset} [status]         List all tasks (optional: pending, completed, in-progress)
  ${COLORS.green}complete${COLORS.reset} <id>         Mark a task as completed
  ${COLORS.green}delete${COLORS.reset} <id>           Delete a task
  ${COLORS.green}stats${COLORS.reset}                 Show task statistics
  ${COLORS.green}help${COLORS.reset}                  Show this help message

${COLORS.bright}EXAMPLES:${COLORS.reset}
  node task.js add "Buy groceries"
  node task.js add "Complete CSE 310 project"
  node task.js list
  node task.js list pending
  node task.js complete 1
  node task.js delete 2
  node task.js stats

${COLORS.bright}NOTES:${COLORS.reset}
  • Task descriptions with spaces must be in quotes
  • Task IDs are auto-generated and start from 1
  • Data is persisted in tasks.json file
`);
}

async function handleAdd(manager, description) {
    try {
        await manager.initialize();
        
        if (!description) {
            showError('Please provide a task description.');
            console.log('Usage: node task.js add "Your task description"');
            return;
        }
        
        const task = await manager.addTask(description);
        showSuccess(`Task added successfully (ID: ${task.id})`);
        console.log(`   Description: ${task.description}`);
    } catch (error) {
        showError(error.message);
    }
}

async function handleList(manager, filter) {
    try {
        await manager.initialize();
        
        if (filter && !VALID_STATUSES.includes(filter)) {
            showError(`Invalid status filter. Use: pending, completed, or in-progress`);
            return;
        }
        
        manager.displayTasks(filter);
        console.log();
    } catch (error) {
        showError(error.message);
    }
}

async function handleComplete(manager, idStr) {
    try {
        await manager.initialize();
        
        if (!idStr) {
            showError('Please provide a task ID.');
            console.log('Usage: node task.js complete <id>');
            return;
        }
        
        if (manager.tasks.length === 0) {
            showError('No tasks found. Please add a task first using: node task.js add "Your task"');
            return;
        }
        
        const id = parseInt(idStr);
        const task = await manager.completeTask(id);
        showSuccess(`Task ${id} marked as completed!`);
        console.log(`   "${task.description}"`);
    } catch (error) {
        showError(error.message);
    }
}

async function handleDelete(manager, idStr) {
    try {
        await manager.initialize();
        
        if (!idStr) {
            showError('Please provide a task ID.');
            console.log('Usage: node task.js delete <id>');
            return;
        }
        
        if (manager.tasks.length === 0) {
            showError('No tasks found. Please add a task first using: node task.js add "Your task"');
            return;
        }
        
        const id = parseInt(idStr);
        const deleted = await manager.deleteTask(id);
        
        if (deleted) {
            showSuccess(`Task ${id} deleted successfully.`);
        }
    } catch (error) {
        showError(error.message);
    }
}

async function handleStats(manager) {
    try {
        await manager.initialize();
        manager.displayStats();
    } catch (error) {
        showError(error.message);
    }
}

// ============================================
// MAIN APPLICATION ENTRY POINT
// ============================================

async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    const argument = args[1];
    
    const manager = new TaskManager();
    
    switch (command) {
        case 'add':
            await handleAdd(manager, argument);
            break;
            
        case 'list':
            await handleList(manager, argument);
            break;
            
        case 'complete':
            await handleComplete(manager, argument);
            break;
            
        case 'delete':
            await handleDelete(manager, argument);
            break;
            
        case 'stats':
            await handleStats(manager);
            break;
            
        case 'help':
        case '--help':
        case '-h':
            showHelp();
            break;
            
        case undefined:
        case null:
            showError('No command provided.');
            showHelp();
            break;
            
        default:
            showError(`Unknown command: ${command}`);
            showHelp();
            break;
    }
}

process.on('uncaughtException', (error) => {
    console.error('\n❌ Unexpected error:', error.message);
    process.exit(1);
});

if (require.main === module) {
    main().catch(error => {
        showError(`Application error: ${error.message}`);
        process.exit(1);
    });
}

module.exports = { Task, TaskManager };