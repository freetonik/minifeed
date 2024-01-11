#!/bin/bash

# Read the version from changelog.ts
version=$(sed -n 's/export const version = "\(.*\)";/\1/p' src/changelog.ts)

# Create a git tag
git tag $version
