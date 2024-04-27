// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { createWriteStream } from 'fs';
import { Readable } from 'stream';
import * as vscode from 'vscode';
const swipl = require('swipl-stdio');

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "logical-english-extension" is now active!');

	// Check configuration
	const pull_pack = vscode.workspace.getConfiguration().get('logicalenglish.pull_pack');
	if (pull_pack) {
		update_le_pack(context);
	}

	//Create output channel
	let le_output = vscode.window.createOutputChannel("Logical English");
	let engine: any;
	let swipl_query: any;
	vscode.commands.executeCommand('setContext', 'logical-english-extension.next-result', swipl_query !== undefined);
	vscode.window.onDidChangeActiveTextEditor(() => {
		console.log("Changed window...refreshing");
		// console.log(vscode.window.activeTextEditor?.document);
		if (swipl_query) {
			swipl_query.close();
		}
		if (engine) {
			engine.close();
		}
	});

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	context.subscriptions.push(
		vscode.commands.registerCommand('logical-english-extension.query', async () => {
			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				return;
			}
			const filename = editor.document.uri.fsPath;
			var fileExt = filename.split('.').pop();
			if (fileExt !== "le" && fileExt !== "pl") {
				return;
			}
			// Set module with .split("/").pop()?
			const module = filename.split("/").pop()?.replace(/\.\w+$/g, "");
			const queries = get_queries(editor, fileExt);
			const scenarios = get_scenarios(editor, fileExt);

			const query = await vscode.window.showQuickPick(queries, {
				ignoreFocusOut: true
			});
			const scenario = await vscode.window.showQuickPick(scenarios, {
				ignoreFocusOut: true
			});

			engine = new swipl.Engine();
			swipl_query = await engine.createQuery(`
working_directory(_, '${filename.replace(/\/\w+.\w+$/g, "")}'),
use_module(${await set_library()}),
read_file_to_string('${filename}', Document, []),
parse_and_query_and_explanation_text('${module}', en(Document), ${query}, with(${scenario}),Answer).`);
			// parse_and_query_and_explanation('${module}', en(Document), ${query}, with(${scenario}), Answer).`);
			// engine.close();
			vscode.commands.executeCommand('setContext', 'logical-english-extension.next-result', swipl_query !== undefined);
			let output = await swipl_query.next();
			le_output.appendLine(`# Answer ${query} with ${scenario}\n`);
			parse_output(JSON.parse(output.Answer), 0, le_output);
			le_output.append("\n");
			le_output.show(true);
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('logical-english-extension.query-next', async () => {
			try {
				let output = await swipl_query.next();
				parse_output(JSON.parse(output.Answer), 0, le_output);
				le_output.append("\n");
				le_output.show(true);
			} catch {
				// le_output.append("false\n\n");
				await swipl_query.close();
				engine.close();
				vscode.commands.executeCommand('setContext', 'logical-english-extension.next-result', false);
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('logical-english-extension.show-prolog', async () => {
			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				return;
			}
			const filename = editor.document.uri.fsPath;
			var fileExt = filename.split('.').pop();
			if (fileExt !== "le" && fileExt !== "pl") {
				return;
			}
			// Set module with .split("/").pop()?
			const module = filename.split("/").pop()?.replace(/\.\w+$/g, "");
			// Newer version of LE can use null, but the older pack returns false.
			const query = get_queries(editor, fileExt)[0];
			const scenario = get_scenarios(editor, fileExt)[0];
			const engine = new swipl.Engine();
			const output = await engine.call(`
working_directory(_, '${filename.replace(/\/\w+.\w+$/g, "")}'),
use_module(${await set_library()}),read_file_to_string('${filename}', Document, []),
parse_and_query_and_explanation('${module}', en(Document), ${query}, with(${scenario}), _),
with_output_to(string(R), show(prolog)).`);
			engine.close();
			le_output.appendLine("# Show prolog for " + module + "\n");
			le_output.appendLine(output.R);
			le_output.show(true);
		})
	);
}

// This method is called when your extension is deactivated
export function deactivate() { }

function get_queries(editor: vscode.TextEditor, fileExt: string) {
	let result: string[] = [];
	let pattern = /(?:query|domanda) (.+?) (?:is|.):/g;
	if (fileExt === "pl") {
		pattern = /example\((.+?),/g;
	}
	if (editor) {
		let text = editor.document.getText();
		const matches = [...text.matchAll(pattern)];
		matches.forEach((item) => {
			result.push(item[1]);
		});
	}
	return result;
}

function get_scenarios(editor: vscode.TextEditor, fileExt: string) {
	let result: string[] = [];
	let pattern = /scenario (.+?) (?:is|.):/g;
	if (fileExt === "pl") {
		pattern = /query\((.+?),/g;
	}
	if (editor) {
		let text = editor.document.getText();
		const matches = [...text.matchAll(pattern)];
		matches.forEach((item) => {
			result.push(item[1]);
		});
	}
	return result;
}

async function set_library() {
	let library = "library(le_answer)";
	if (vscode.workspace.workspaceFolders === undefined) {
		console.log("ERROR");
		return;
	}
	try {
		let path = vscode.workspace.workspaceFolders[0].uri.path + "/le_answer.pl";
		await vscode.workspace.fs.stat(vscode.Uri.file(path));
		console.log("Using Local version ...");
		library = `\'${path}\'`;
	} finally {
		return library;
	}
}

function parse_output(output: any[], intent: number, le_output: vscode.OutputChannel) {
	// return convert(output.toString(), {}).replace(/(^| )\* /gm, "$1  ").replace(/and\n\s+/gm, "and ") + "\n\n";
	output.map((val, index) => {
		if (Array.isArray(val)) {
			le_output.appendLine(" ".repeat(intent + 4) + "because");
			parse_output(val, intent + 4, le_output);
		} else {
			if (index === 0) {
				le_output.appendLine(" ".repeat(intent) + val);
			} else {
				// Make sure to use same constant value(4), which is used to increment intent
				le_output.appendLine(" ".repeat(intent) + "and " + val);
			}
		}
	});
}

async function update_le_pack(context: vscode.ExtensionContext) {
	const engine = new swipl.Engine();
	const output = await engine.call(`pack_info(logicalenglish).`);
	console.log(output);
	if (output !== false) {
		console.log("Logical English pack already installed.");

	} else {
		console.log("Logical English pack missing. Downloading...");
		// Use the bundled version temporarily
		const filename = context.asAbsolutePath('logicalenglish-0.0.4.zip');
		await engine.call(`pack_install('${filename}', [interactive(false)]).`);
		// const answer = await fetch("https://api.github.com/repos/logicalcontracts/logicalenglish/contents/pack");
		// const le_repo = await answer.json();
		// //@ts-ignore
		// const le_pack = le_repo[le_repo.length-1].download_url;
		// const filename = le_pack.split("/").pop();
		// let writer = createWriteStream(`/tmp/${filename}`);
		// let content = await fetch(le_pack);
		// if (content.ok && content.body) {
		// 	Readable.fromWeb(content.body).pipe(writer);
		// 	await engine.call(`pack_install('/tmp/${filename}', [interactive(false)]).`);
		// }
	}
	engine.close();
}