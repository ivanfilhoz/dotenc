#!/bin/bash
# Assertion helpers for e2e tests

fail() {
    echo "FAIL: $1" >&2
    exit 1
}

assert_file_exists() {
    local file="$1"
    [ -f "$file" ] || fail "File does not exist: $file"
}

assert_file_not_exists() {
    local file="$1"
    [ ! -f "$file" ] || fail "File should not exist: $file"
}

assert_file_contains() {
    local file="$1"
    local expected="$2"
    grep -q "$expected" "$file" || fail "File $file does not contain: $expected"
}

assert_output_contains() {
    local output="$1"
    local expected="$2"
    echo "$output" | grep -q "$expected" || fail "Output does not contain: $expected"
}

assert_output_not_contains() {
    local output="$1"
    local unexpected="$2"
    if echo "$output" | grep -q "$unexpected"; then
        fail "Output should not contain: $unexpected"
    fi
}

assert_json_field() {
    local file="$1"
    local field_path="$2"
    local expected="$3"
    local actual
    actual=$(node -e "
        const data = JSON.parse(require('fs').readFileSync('$file', 'utf-8'));
        process.stdout.write(String(data.$field_path));
    ")
    if [ "$actual" != "$expected" ]; then
        fail "Expected $field_path to be '$expected', got '$actual' in $file"
    fi
}

assert_json_array_length() {
    local file="$1"
    local field_path="$2"
    local expected="$3"
    local actual
    actual=$(node -e "
        const data = JSON.parse(require('fs').readFileSync('$file', 'utf-8'));
        process.stdout.write(String(data.$field_path.length));
    ")
    if [ "$actual" != "$expected" ]; then
        fail "Expected $field_path to have length $expected, got $actual in $file"
    fi
}
