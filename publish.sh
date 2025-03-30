#!/bin/bash
#
# Requires GitHub CLI

set -e  # Exit immediately if any command fails

# Retrieve the version from package.json (using Node.js)
version=$(node -p "require('./package.json').version")
if [ -z "$version" ]; then
  echo "Error: Could not determine version from package.json."
  exit 1
fi

echo "Current version from package.json: $version"

# Check that a Git tag already exists that matches the version.
# Adjust the tag name as needed (e.g., include a "v" prefix) if your repo uses a different convention.
if ! git tag --list "$version" | grep -q "$version"; then
  echo "Error: Git tag '$version' does not exist. Please create the tag before releasing."
  exit 1
fi

echo "Git tag '$version' found."

# Push the tag to the remote repository
echo "Pushing the tag '$version' to the remote repository..."
git push origin "$version"

# Check that a GitHub release for this version does NOT already exist.
if gh release view "$version" >/dev/null 2>&1; then
  echo "Error: A GitHub release for version '$version' already exists."
  exit 1
fi

echo "No existing GitHub release found for '$version'. Proceeding..."

echo "Building the code artifact..."
npm install
npm run build

# Create the GitHub release including the specified asset files.
# Here main.js, styles.css, and manifest.json (located in the root directory) are attached.
gh release create "$version" main.js styles.css manifest.json \
  --title "$version" \
  --generate-notes \
  --draft \

echo "GitHub draft release for version '$version' created successfully."
