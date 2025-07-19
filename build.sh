#!/bin/bash

# Install server dependencies
echo "Installing server dependencies..."
npm install

# Install client dependencies and build
echo "Installing client dependencies and building client..."
cd client
npm install --legacy-peer-deps
npm run build
cd ..

echo "Build completed successfully!"