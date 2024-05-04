// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import SWIPL, { SWIPLModule, Query } from "swipl-wasm";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "logical-english-extension" is now active!');

	//Create output channel
	let le_output = vscode.window.createOutputChannel("Logical English");
	const swipl = await SWIPL({ arguments: ["-q"] });

	//@ts-ignore
	// vscode.window.showInformationMessage(swipl.prolog.query("member(X, [a, b, c]).").once().X);

	// Check configuration
	const pull_pack = vscode.workspace.getConfiguration().get('logicalenglish.pull_pack');
	if (pull_pack) {
		await update_le_pack(context, swipl);
	}

	let swipl_query: Query;
	let answers: Array<string> = [];


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
			const content = editor.document.getText();
			const queries = get_queries(editor, fileExt);
			const scenarios = get_scenarios(editor, fileExt);

			const query = await vscode.window.showQuickPick(queries, {
				ignoreFocusOut: true
			});
			const scenario = await vscode.window.showQuickPick(scenarios, {
				ignoreFocusOut: true
			});
			swipl_query = swipl.prolog.query(`
consult('/logicalenglish/prolog/le_answer.pl'),
parse_and_query_and_explanation_text('${module}', en("${content}"), ${query}, with(${scenario}),Answer).`);
			// parse_and_query_and_explanation('${module}', en(Document), ${query}, with(${scenario}), Answer).`);
			// engine.close();
			vscode.commands.executeCommand('setContext', 'logical-english-extension.next-result', swipl_query !== undefined);
			let output = await swipl_query.next();
			le_output.appendLine(`# Answer ${query} with ${scenario}\n`);
			// @ts-ignore
			const answer = output.value.Answer;
			answers.push(answer.v.replace(/_\d+/gm, 'tmp'));
			parse_output(JSON.parse(answer), 0, le_output);
			le_output.append("\n");
			le_output.show(true);
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('logical-english-extension.query-next', async () => {
			try {
				let output = await swipl_query.next();
				// @ts-ignore
				const answer = output.value.Answer;
				const answer_escaped = answer.v.replace(/_\d+/gm, 'tmp');
				if (answers.includes(answer_escaped)) {
					throw Error;
				}
				answers.push(answer_escaped);
				parse_output(JSON.parse(answer), 0, le_output);
				le_output.append("\n");
				le_output.show(true);
			} catch (error) {
				console.log("Reset answer list");
				answers = [];
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
			const content = editor.document.getText();
			const query = get_queries(editor, fileExt)[0];
			const scenario = get_scenarios(editor, fileExt)[0];
			const output = swipl.prolog.query(`
consult('/logicalenglish/prolog/le_answer.pl'),
parse_and_query_and_explanation('${module}', en("${content}"), ${query}, with(${scenario}), _),
with_output_to(string(R), show(prolog)).`).once();
			le_output.appendLine("# Show prolog for " + module + "\n");
			//@ts-ignore
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

// async function set_library() {
// 	let library = "library(le_answer)";
// 	if (vscode.workspace.workspaceFolders === undefined) {
// 		console.log("ERROR");
// 		return;
// 	}
// 	try {
// 		let path = vscode.workspace.workspaceFolders[0].uri.path + "/le_answer.pl";
// 		await vscode.workspace.fs.stat(vscode.Uri.file(path));
// 		console.log("Using Local version ...");
// 		library = `\'${path}\'`;
// 	} finally {
// 		return library;
// 	}
// }

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

async function update_le_pack(context: vscode.ExtensionContext, swipl: SWIPLModule) {
	// const folder = context.extensionUri("logicalenglish-0.0.4");
	// console.log(await vscode.workspace.fs.readDirectory(vscode.Uri.file(folder)));
	swipl.FS.mkdir("logicalenglish");
	swipl.FS.mkdir("logicalenglish/prolog");
	swipl.FS.mkdir("logicalenglish/prolog/spacy");
	swipl.FS.mkdir("logicalenglish/prolog/tokenize");
	swipl.FS.mkdir("logicalenglish/prolog/tokenize/prolog");
	const files = [`logicalenglish/pack.pl`,
		`logicalenglish/README.md`,
		`logicalenglish/LICENSE.txt`,
		`logicalenglish/prolog/le_local.pl`,
		`logicalenglish/prolog/le_answer.pl`,
		`logicalenglish/prolog/api.pl`,
		`logicalenglish/prolog/le_input.pl`,
		`logicalenglish/prolog/spacy/spacy.pl`,
		`logicalenglish/prolog/kp_loader.pl`,
		`logicalenglish/prolog/reasoner.pl`,
		`logicalenglish/prolog/syntax.pl`,
		`logicalenglish/prolog/drafter.pl`,
		`logicalenglish/prolog/tokenize/prolog/tokenize.pl`,
		`logicalenglish/prolog/tokenize/prolog/tokenize_opts.pl`]
	console.log(files);
	files.forEach(async (file) => {
		// var path = file.toString().replace(/.*logicalenglish-0\.0\.4\//gm, '');
		// console.log(path);
		var content = await vscode.workspace.fs.readFile(vscode.Uri.file(context.asAbsolutePath('logicalenglish-0.0.4/' + file)));
		// vscode.window.showInformationMessage(content.toString());
		swipl.FS.writeFile(file, await vscode.workspace.fs.readFile(vscode.Uri.file(context.asAbsolutePath('logicalenglish-0.0.4/' + file))));
	});
}
