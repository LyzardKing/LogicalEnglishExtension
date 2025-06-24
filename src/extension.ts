// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import SWIPL, { SWIPLModule, Query } from "swipl-wasm";

// Encapsulate extension state in a class
class LogicalEnglishExtension {
	private swipl: SWIPLModule | null = null;
	private swiplQuery: Query | null = null;
	private leOutput = vscode.window.createOutputChannel("Logical English");
	private context: vscode.ExtensionContext;

	constructor(context: vscode.ExtensionContext) {
		this.context = context;
	}

	async initializeSwipl(forceReload = false) {
		if (this.swipl && !forceReload) {
			return this.swipl;
		}
		this.swipl = await SWIPL({
			arguments: ["-q"],
			//@ts-ignore
			preRun: [(module: SWIPLModule) => update_le_pack(this.context, module)],
		});
		return this.swipl;
	}

	async handleLoadLe() {
		this.leOutput.clear();
		this.leOutput.appendLine("Loading Logical English...");
		await this.initializeSwipl(true);
	}

	async handleQuery() {
		await this.initializeSwipl();
		if (this.swiplQuery) {
			await this.swiplQuery.once();
		}
		const editor = vscode.window.activeTextEditor;
		if (!editor) return;
		const filename = editor.document.uri.path;
		const fileExt = filename.split('.').pop();
		if (fileExt !== "le" && fileExt !== "pl") return;
		const module = filename.split("/").pop()?.replace(/\.\w+$/g, "");
		const content = editor.document.getText();
		const queries = getQueries(editor, fileExt);
		const scenarios = getScenarios(editor, fileExt);
		if (queries.length === 0 || scenarios.length === 0) {
			vscode.window.showWarningMessage("No queries or scenarios found.");
			return;
		}
		const query = await vscode.window.showQuickPick(queries, { ignoreFocusOut: true });
		const scenario = await vscode.window.showQuickPick(scenarios, { ignoreFocusOut: true });
		if (!query || !scenario) return;
		this.swiplQuery = this.swipl!.prolog.query(`
consult('logicalenglish/prolog/le_answer.pl'),
parse_and_query_and_explanation_text('${module}', en("${content}"), ${query}, with(${scenario}),Answer).`);
		let output = await this.swiplQuery.next();
		this.leOutput.appendLine(`% Answer ${query} with ${scenario}\n`);
		// @ts-ignore
		const answer = output.value.Answer;
		parse_output(JSON.parse(answer), 0, this.leOutput);
		this.leOutput.append("\n");
		this.leOutput.show(true);
		// await vscode.commands.executeCommand('setContext', 'logical-english-extension.next-result', this.swiplQuery !== undefined);
		vscode.commands.executeCommand('setContext', 'hasNextSolution', this.swiplQuery !== undefined);
	}

	async handleQueryNext() {
		try {
			if (!this.swiplQuery) return;
			let output = await this.swiplQuery.next() as { value?: { Answer: string } };
			if (!output || !output.value) {
				this.leOutput.appendLine("No more answers...");
				vscode.commands.executeCommand('setContext', 'hasNextSolution', false);
				return;
			}
			const answer = output.value.Answer;
			parse_output(JSON.parse(answer), 0, this.leOutput);
			this.leOutput.append("\n");
			this.leOutput.show(true);
		} catch (error) {
			console.log("Reset answer list");
			console.log(error);
		}
	}

	async handleShowProlog() {
		await this.initializeSwipl();
		const editor = vscode.window.activeTextEditor;
		if (!editor) return;
		const filename = editor.document.uri.path;
		const fileExt = filename.split('.').pop();
		if (fileExt !== "le" && fileExt !== "pl") return;
		const module = filename.split("/").pop()?.replace(/\.\w+$/g, "");
		const content = editor.document.getText();
		const queries = getQueries(editor, fileExt);
		const scenarios = getScenarios(editor, fileExt);
		if (queries.length === 0 || scenarios.length === 0) {
			vscode.window.showWarningMessage("No queries or scenarios found.");
			return;
		}
		const query = queries[0];
		const scenario = scenarios[0];
		let output = this.swipl!.prolog.query(`
consult('logicalenglish/prolog/le_answer.pl'),
parse_and_query_and_explanation_text('${module}', en("${content}"), ${query}, with(${scenario}),Answer),
with_output_to(string(R), show(prolog)).`).once();
		this.leOutput.appendLine("% Show prolog for " + module + "\n");
		//@ts-ignore
		this.leOutput.appendLine(output.value.R);
		this.leOutput.show(true);
	}

	async watchErrorFile() {
		// Watch for ".error.log" in the workspace root
		// this.handleShowProlog();
		await this.initializeSwipl();
		const editor = vscode.window.activeTextEditor;
		if (!editor) return;
		const filename = editor.document.uri.path;
		const fileExt = filename.split('.').pop();
		if (fileExt !== "le" && fileExt !== "pl") return;
		const module = filename.split("/").pop()?.replace(/\.\w+$/g, "");
		const content = editor.document.getText();
		const queries = getQueries(editor, fileExt);
		const scenarios = getScenarios(editor, fileExt);
		if (queries.length === 0 || scenarios.length === 0) {
			vscode.window.showWarningMessage("No queries or scenarios found.");
			return;
		}
		const query = queries[0];
		const scenario = scenarios[0];

		this.swipl!.prolog.query(`
consult('logicalenglish/prolog/le_answer.pl'),
parse_and_query_and_explanation_text('${module}', en("${content}"), ${query}, with(${scenario}),_).`).once();
		let error = this.swipl!.prolog.query(`captured_message(M).`).once();
		this.leOutput.appendLine("% Error for " + module + "\n");
		console.log(error);
		if (error !== undefined) {
			// @ts-ignore
			this.leOutput.appendLine("% Error: " + error.value.M);
			this.leOutput.show(true);
		}
	}
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "logical-english-extension" is now active!');

	const leExtension = new LogicalEnglishExtension(context);

	context.subscriptions.push(
		vscode.window.onDidChangeActiveTextEditor(
			() => {
				leExtension.handleLoadLe();
				leExtension.watchErrorFile();
			}
		)
	)

	context.subscriptions.push(
		vscode.workspace.onDidSaveTextDocument(
			() => {
				leExtension.handleLoadLe();
				leExtension.watchErrorFile();
			}
		)
	)

	context.subscriptions.push(
		vscode.commands.registerCommand('logical-english-extension.query', () => leExtension.handleQuery())
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('logical-english-extension.query-next', () => leExtension.handleQueryNext())
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('logical-english-extension.show-prolog', () => leExtension.handleShowProlog())
	);
}

// This method is called when your extension is deactivated
export function deactivate() { }

function getQueries(editor: vscode.TextEditor, fileExt: string) {
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

function getScenarios(editor: vscode.TextEditor, fileExt: string) {
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

function update_le_pack(context: vscode.ExtensionContext, swipl: SWIPLModule) {
	// console.log(await vscode.workspace.fs.readDirectory(vscode.Uri.file(folder)));
	swipl.FS.mkdir("logicalenglish");
	swipl.FS.mkdir("logicalenglish/prolog");
	swipl.FS.mkdir("logicalenglish/prolog/spacy");
	swipl.FS.mkdir("logicalenglish/prolog/tokenize");
	swipl.FS.mkdir("logicalenglish/prolog/tokenize/prolog");
	const files = [
		// `logicalenglish/pack.pl`,
		`logicalenglish/prolog/le_local.pl`,
		`logicalenglish/prolog/le_answer.pl`,
		// `logicalenglish/prolog/api.pl`,
		`logicalenglish/prolog/le_input.pl`,
		`logicalenglish/prolog/spacy/spacy.pl`,
		`logicalenglish/prolog/kp_loader.pl`,
		`logicalenglish/prolog/reasoner.pl`,
		`logicalenglish/prolog/syntax.pl`,
		`logicalenglish/prolog/drafter.pl`,
		`logicalenglish/prolog/tokenize/prolog/tokenize.pl`,
		`logicalenglish/prolog/tokenize/prolog/tokenize_opts.pl`]
	// console.log(files);
	files.forEach((file) => {
		// console.log(file);
		// swipl.FS.writeFile(file, fs.readFileSync(file))
		vscode.workspace.fs.readFile(vscode.Uri.joinPath(context.extensionUri, ...file.split("/"))).then((content) =>
			swipl.FS.writeFile(file, content)
		);
	});
}
