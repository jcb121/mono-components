# variant

A CLI for branching and rebasing folders — like `git branch` and `git rebase`, but for directory variants.

## Install

```sh
npm install -g mono-components
```

## Commands

### `variant branch <source> <target>`

Copy a folder into a new variant. Creates a `variant.json` in the target that tracks the source and base snapshot.

```sh
variant branch ./src/button ./src/button-large
```

### `variant rebase <source> [target]`

Apply upstream changes from `source` into a variant, preserving the variant's own modifications (3-way merge via `git merge-file`).

```sh
variant rebase ./src/button ./src/button-large
```

If there are conflicting changes, standard git conflict markers are left in the file for you to resolve.

#### `--all`

Rebase all variants branched from `source` in one shot.

```sh
variant rebase ./src/button --all
```

#### `--force`

By default, rebasing a target that has downstream variants will error to prevent stale dependents. Use `--force` to proceed anyway.

```sh
variant rebase ./src/button ./src/button-large --force
```

### `variant list <source>`

List all variants branched from a component.

```sh
variant list ./src/button
```

## How it works

`branch` copies the source folder and embeds a compressed base snapshot inside `variant.json`. When you later run `rebase`, the tool extracts the base snapshot, runs a 3-way merge (source → base → target) on each file, and updates the snapshot for future rebases.

This means:
- Works on any folder of files — not tied to any framework or language
- No git repository required
- Variants stay in sync with their source without overwriting local changes
- Changes chain correctly across multiple rebases

## Requirements

- Node.js 22+
- `git` installed and available in `PATH` (used for `git merge-file`)
