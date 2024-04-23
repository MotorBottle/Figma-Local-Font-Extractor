import sys
import json
import os
import platform
import logging
import shutil
from fontTools.ttLib import TTFont, TTLibError

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')

def find_font_files(font_families):
    os_name = platform.system()
    font_dirs = []
    if os_name == 'Windows':
        font_dirs = ['C:\\Windows\\Fonts', os.path.expanduser('~\\AppData\\Local\\Microsoft\\Windows\\Fonts')]
    elif os_name == 'Darwin':
        font_dirs = ['/Library/Fonts', '/System/Library/Fonts', '~/Library/Fonts']
    elif os_name == 'Linux':
        font_dirs = ['/usr/share/fonts', '/usr/local/share/fonts', '~/.fonts']
    
    font_dirs = [os.path.expanduser(dir) for dir in font_dirs]
    font_files = []
    for dir in font_dirs:
        for root, dirs, files in os.walk(dir):
            for file in files:
                if file.lower().endswith(('.ttf', '.otf', '.woff', '.woff2')):
                    font_path = os.path.join(root, file)
                    try:
                        font = TTFont(font_path, lazy=True)
                        name_record = font['name'].getName(nameID=1, platformID=3, platEncID=1, langID=0x0409)
                        if name_record:
                            font_family_name = name_record.toUnicode().lower()
                            if any(family.lower() in font_family_name for family in font_families):
                                font_files.append(font_path)
                    except TTLibError as e:
                        # Ignore the specific TTLibError if needed
                        pass
                    except Exception as e:
                        # Ignore errors related to bad sfntVersion or other specified errors
                        if "bad sfntVersion" not in str(e) and "specify a font number" not in str(e):
                            logging.error(f"Error processing {file}: {e}")
                        # Optionally, you can continue without breaking the loop
                        continue
    return font_files

def copy_fonts(font_files, dest_folder):
    if not os.path.exists(dest_folder):
        os.makedirs(dest_folder)
    for file_path in font_files:
        shutil.copy(file_path, dest_folder)

if __name__ == '__main__':
    font_families = sys.argv[1].split(',')
    dest_folder = sys.argv[2]
    copied_files = []

    try:
        font_files = find_font_files(font_families)
        for font_file in font_files:
            dest_file_path = os.path.join(dest_folder, os.path.basename(font_file))
            if not os.path.exists(dest_file_path):
                shutil.copy(font_file, dest_folder)
                copied_files.append(font_file)

        result = {
            "copiedFiles": copied_files,
            "count": len(copied_files)
        }
        print(json.dumps(result))  # Output the result as JSON
        sys.stdout.flush()
    except Exception as e:
        error_message = {"status": "Error", "message": str(e)}
        print(json.dumps(error_message))
        sys.stdout.flush()
        sys.exit(1)