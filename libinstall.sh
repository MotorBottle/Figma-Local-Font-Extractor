#!/bin/bash

# Check for Python 3 and install if not present
if ! command -v python3 &> /dev/null
then
    echo "Python 3 is not installed."
    # Install Python here (e.g., using Homebrew: `brew install python`)
fi

# Install necessary Python packages
pip3 install fonttools

echo "Dependencies installed successfully."
