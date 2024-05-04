# Logical English VSCode Extension

Logical English is a controlled natural language built on Prolog that can be used for programming and knowledge representation.

## Features

The extension makes it possible to query a Logical English program directly from Visual Studio Code.

The extension is loaded automatically on opening a file with the correct extension(`le` or `pl`).
There are three included commands:

![](icons/play.svg) `logical-english-extension.query` "Query Logical English, choosing from the queries and scenarios found in the document"

![](icons/debug-continue.svg)`logical-english-extension.query-next` "Query Logical English - Next Solution, look for additional solutions"

![](icons/debug.svg)`logical-english-extension.show-prolog` "Show Prolog - Logical English, print the automatically generated Prolog code"

The three commands can also be accessed through the buttons that appear on the top right of the window.

## Requirements

The extension will use the wasm version of swi-prolog, so there are no external dependencies that need to be installed.