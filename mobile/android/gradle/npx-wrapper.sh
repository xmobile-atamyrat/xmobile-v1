#!/bin/bash
# Wrapper script for npx that ensures PATH includes Homebrew's bin directory
export PATH="/opt/homebrew/bin:$PATH"
exec /opt/homebrew/bin/npx "$@"
