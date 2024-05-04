import * as vscode from 'vscode';

export class LEDocumentSymbolProvider implements vscode.DocumentSymbolProvider {

    public provideDocumentSymbols(
        document: vscode.TextDocument,
        token: vscode.CancellationToken): Thenable<vscode.DocumentSymbol[]> {
        return new Promise((resolve, reject) => {
            const symbols: vscode.DocumentSymbol[] = [];

            for (let i = 0; i < document.lineCount; i++) {
                const line = document.lineAt(i);
                const tokens = line.text.split(" ");

                if (line.text.startsWith("scenario")) {
                    symbols.push({
                        name: tokens[1],
                        kind: vscode.SymbolKind.Field,
                        detail: '',
                        range: line.range,
                        selectionRange: line.range,
                        children: []
                    });

                }
                else if (line.text.startsWith("query")) {
                    symbols.push({
                        name: tokens[1],
                        kind: vscode.SymbolKind.Field,
                        detail: '',
                        range: line.range,
                        selectionRange: line.range,
                        children: []
                    });
                }
            }
            resolve(symbols);
        });
    }
}