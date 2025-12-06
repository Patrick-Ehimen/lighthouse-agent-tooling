#!/bin/bash

# Start MCP Server with environment variables from .env

# Export variables from .env file
export $(grep -v '^#' .env | xargs)

# Start the server
node dist/index.js
