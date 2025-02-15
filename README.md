# Obsidian LLM docs

This is a plugin for Obsidian (https://obsidian.md) that lets you chat with LLMs in plain markdown files!

## Features

- Use the same Obsidian markdown editor you know and love to chat with LLMs and freely edit conversation history
- Integrates with the OpenAI API
- Also works with self-hosted/local LLMs that expose an OpenAI-compatible API, like Ollama (https://ollama.com)
- Can follow links to other Obsidian documents included in your prompt, making it easier to include additional context

## Dev installation

- Install/use the version of NodeJS specified in the `.tool-versions` file
- Run `npm i` to install dependencies.
- Run `npm run dev` to start compilation in watch mode.
- Reload Obsidian.
- Enable plugin in settings window.
- For updates to the Obsidian API run `npm update` in the command line under your repo folder.

## Releasing new releases

- Update your `manifest.json` with your new version number, such as `1.0.1`, and the minimum Obsidian version required for your latest release.
- Update your `versions.json` file with `"new-plugin-version": "minimum-obsidian-version"` so older versions of Obsidian can download an older version of your plugin that's compatible.
- Create new GitHub release using your new version number as the "Tag version". Use the exact version number, don't include a prefix `v`. See here for an example: https://github.com/obsidianmd/obsidian-sample-plugin/releases
- Upload the files `manifest.json`, `main.js`, `styles.css` as binary attachments. Note: The manifest.json file must be in two places, first the root path of your repository and also in the release.
- Publish the release.

> You can simplify the version bump process by running `npm version patch`, `npm version minor` or `npm version major` after updating `minAppVersion` manually in `manifest.json`.
> The command will bump version in `manifest.json` and `package.json`, and add the entry for the new version to `versions.json`

## Adding your plugin to the community plugin list

- Check the [plugin guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines).
- Publish an initial version.
- Make sure you have a `README.md` file in the root of your repo.
- Make a pull request at https://github.com/obsidianmd/obsidian-releases to add your plugin.
