import os

# --- CONFIGURATION ---
# The name of the output file that will be generated.
OUTPUT_FILENAME = "project_snapshot.txt"

# --- EXCLUSION SETS ---
# Add folder names, file names, or extensions to these sets to exclude them.

# 1. Directories to completely skip. The script will not traverse into these.
#    Defaults are for .NET/Rider projects, git, and common web dependencies.
EXCLUDED_DIRS = {
  ".git",
  ".idea",      # JetBrains Rider/IntelliJ project settings
  "fable_build"
  "bin",        # Compiled output
  "obj",        # Intermediate build files
  "node_modules", # Frontend dependencies
  "packages",   # NuGet packages folder
  "__pycache__",# Python cache
}

# 2. Specific file names to skip.
EXCLUDED_FILES = {
  ".DS_Store",              # macOS metadata
  OUTPUT_FILENAME,          # Exclude the script's own output file!
  "create_snapshot.py",     # Exclude the script itself
  "package-lock.json"
}

# 3. File extensions to skip.
#    Defaults include binaries, build artifacts, and common non-text files.
EXCLUDED_EXTENSIONS = {
  # .NET / Build artifacts
  ".dll",
  ".exe",
  ".pdb",
  ".nupkg",
  ".sln.DotSettings.user",

  # Common non-text files
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".pdf",
  ".zip",
  ".log",
  ".ico",
  ".svg",
}

def create_project_snapshot():
  """
  Traverses the project directory, reads the content of relevant files,
  and concatenates them into a single text file.
  """
  # Get the absolute path of the directory where the script is located.
  project_root = os.path.abspath(os.path.dirname(__file__))
  output_file_path = os.path.join(project_root, OUTPUT_FILENAME)

  print(f"Starting project snapshot...")
  print(f"Output will be saved to: {output_file_path}")

  with open(output_file_path, "w", encoding="utf-8", errors="ignore") as outfile:
    # os.walk provides a 3-tuple for each directory it visits:
    # dirpath: the path of the current directory
    # dirnames: a list of subdirectories in dirpath
    # filenames: a list of files in dirpath
    for dirpath, dirnames, filenames in os.walk(project_root, topdown=True):

      # --- Directory Exclusion Logic ---
      # We modify 'dirnames' in-place to prevent os.walk from traversing
      # into the excluded directories.
      dirs_to_remove = []
      for d in dirnames:
        if d in EXCLUDED_DIRS:
          dirs_to_remove.append(d)

          # Log that we are skipping this directory
          skipped_dir_path = os.path.abspath(os.path.join(dirpath, d))
          print(f"  -> Skipping directory: {d}")
          outfile.write(f"--- SKIPPING DIRECTORY: {skipped_dir_path} ---\n\n")

      # This is the standard way to remove items from a list while iterating
      for d in dirs_to_remove:
        dirnames.remove(d)

      # --- File Processing Logic ---
      for filename in sorted(filenames):

        # Check for file name and extension exclusions
        _, extension = os.path.splitext(filename)
        if filename in EXCLUDED_FILES or extension in EXCLUDED_EXTENSIONS:
          print(f"  -> Skipping file: {filename}")
          continue

        file_path = os.path.join(dirpath, filename)
        absolute_file_path = os.path.abspath(file_path)

        print(f"  -> Processing: {absolute_file_path}")

        try:
          with open(file_path, "r", encoding="utf-8", errors="ignore") as infile:
            content = infile.read()

          # Write the file's content to the snapshot
          outfile.write("--- START FILE ---\n")
          outfile.write(f"PATH: {absolute_file_path}\n\n")
          outfile.write(content)
          outfile.write("\n--- END FILE ---\n\n")

        except Exception as e:
          print(f"    [ERROR] Could not read file {file_path}: {e}")
          outfile.write(f"--- ERROR READING FILE: {absolute_file_path} ({e}) ---\n\n")

  print("\nProject snapshot created successfully!")
  print(f"File saved as: {OUTPUT_FILENAME}")

if __name__ == "__main__":
  create_project_snapshot()