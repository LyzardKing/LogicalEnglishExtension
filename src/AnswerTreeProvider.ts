import * as vscode from 'vscode';
import * as json from 'jsonc-parser';

export class LogicalEnglishAnswerProvider implements vscode.TreeDataProvider<Dependency> {
  LEAnswerTree: Dependency[] = [];

  constructor(private answer: string) { }

  getTreeItem(element: Dependency): vscode.TreeItem {
    const item = new vscode.TreeItem(element.label!, element.collapsibleState);
    return item;
  }

  // and getChildren
  public getChildren(element: Dependency | undefined): vscode.ProviderResult<Dependency[]> {
    if (element === undefined) {
      return this.LEAnswerTree;
    } else {
      return element.children;
    }
  }

  public refresh(output: any[], parent: Dependency | undefined = this.LEAnswerTree.at(-1)) {
    let item = parent;
    output.forEach((val) => {
      if (Array.isArray(val)) {
        this.refresh(val, item);
      }
      else if (parent) {
        item = new Dependency(val);
        parent.children.push(item);
      } else {
        item = new Dependency(val);
        this.LEAnswerTree.push(item);
      }
    });
  }
}

class Dependency extends vscode.TreeItem {
  public children: Dependency[] = [];
  constructor(
    public readonly label: string,
  ) {
    super(label, vscode.TreeItemCollapsibleState.Expanded);
  }

  public add_child(child: Dependency) {
    this.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
    this.children.push(child);
  }
}