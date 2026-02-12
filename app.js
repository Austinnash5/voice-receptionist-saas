/**
 * cPanel Entry Point
 * This file is the startup file for cPanel Node.js App
 * It loads the compiled TypeScript application
 */

require('dotenv').config();

// Load the compiled TypeScript application
require('./dist/index.js');
