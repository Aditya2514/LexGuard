const { buildGlobalSymbolTable } = require('../src/services/agent0SymbolTable');
const fs = require('fs');
const path = require('path');

async function testASTCompiler() {
  console.log('--- Testing Agent 0 (Semantic AST Compiler) ---');
  
  // Create a massive fake contract with definitions buried at the bottom
  const dummyPreamble = 'This is the preamble. "Company" means LexGuard Pvt Ltd.\n' + 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(2000); // ~114k characters of junk
  const dummyDefinitions = '\n\nSchedule 1: Definitions\n"Adverse Event" means a breach.\n"Vesting" means 4 years.\n' + 'Sed do eiusmod tempor incididunt ut labore. '.repeat(500); // ~22k characters of definitions
  
  const massiveContract = dummyPreamble + dummyDefinitions;
  console.log(`Simulated Contract Size: ${massiveContract.length} characters.`);
  
  // Build the symbol table
  const symbolTable = await buildGlobalSymbolTable(massiveContract);
  
  console.log('--- Resulting Symbol Table ---');
  console.log(symbolTable);
  
  if (symbolTable['Adverse Event'] && symbolTable['Company']) {
    console.log('✅ PASS: Successfully extracted definitions from both the preamble and the buried Schedule 1.');
  } else {
    console.log('❌ FAIL: Missing buried definitions.');
  }
}

testASTCompiler();
