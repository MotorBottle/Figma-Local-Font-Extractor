#!/usr/bin/env python3
import pkg_resources
import subprocess
import sys

def check_and_install(package):
    try:
        pkg_resources.get_distribution(package)
        print(f"{package} is already installed.")
    except pkg_resources.DistributionNotFound:
        print(f"{package} not found, installing...")
        subprocess.call([sys.executable, "-m", "pip", "install", package])

if __name__ == "__main__":
    check_and_install('fonttools')
