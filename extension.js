const vscode = require('vscode');

// Event index: { eventName: { definitions: [LocationData], references: [LocationData] } }
let eventIndex = {};
let isIndexing = false;

// Patterns to match event functions
const DEFINITION_PATTERNS = [
  /RegisterNetEvent\s*\(\s*['"]([^'"]+)['"]/g,
  /AddEventHandler\s*\(\s*['"]([^'"]+)['"]/g,
];

const REFERENCE_PATTERNS = [
  /TriggerEvent\s*\(\s*['"]([^'"]+)['"]/g,
  /TriggerServerEvent\s*\(\s*['"]([^'"]+)['"]/g,
  /TriggerClientEvent\s*\(\s*['"]([^'"]+)['"]/g,
  /TriggerLatentServerEvent\s*\(\s*['"]([^'"]+)['"]/g,
  /TriggerLatentClientEvent\s*\(\s*['"]([^'"]+)['"]/g,
];

const ALL_PATTERNS = [...DEFINITION_PATTERNS, ...REFERENCE_PATTERNS];

async function findLuaFiles() {
  return await vscode.workspace.findFiles('**/*.lua', '**/node_modules/**');
}

function parseFile(content, uri) {
  const lines = content.split('\n');
  const results = { definitions: [], references: [] };

  lines.forEach((line, lineIndex) => {
    for (const pattern of DEFINITION_PATTERNS) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(line)) !== null) {
        const eventName = match[1];
        const quoteChar = match[0].includes("'") ? "'" : '"';
        const eventStart = line.indexOf(quoteChar + eventName + quoteChar, match.index);
        const startChar = eventStart + 1;
        const endChar = startChar + eventName.length;
        results.definitions.push({
          eventName, uri, line: lineIndex, startChar, endChar,
          range: new vscode.Range(lineIndex, startChar, lineIndex, endChar),
        });
      }
    }

    for (const pattern of REFERENCE_PATTERNS) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(line)) !== null) {
        const eventName = match[1];
        const quoteChar = match[0].includes("'") ? "'" : '"';
        const eventStart = line.indexOf(quoteChar + eventName + quoteChar, match.index);
        const startChar = eventStart + 1;
        const endChar = startChar + eventName.length;
        results.references.push({
          eventName, uri, line: lineIndex, startChar, endChar,
          range: new vscode.Range(lineIndex, startChar, lineIndex, endChar),
        });
      }
    }
  });

  return results;
}

async function buildIndex() {
  if (isIndexing) return;
  isIndexing = true;
  eventIndex = {};

  try {
    const files = await findLuaFiles();
    for (const file of files) {
      try {
        const document = await vscode.workspace.openTextDocument(file);
        const results = parseFile(document.getText(), file);

        for (const def of results.definitions) {
          if (!eventIndex[def.eventName]) eventIndex[def.eventName] = { definitions: [], references: [] };
          eventIndex[def.eventName].definitions.push(def);
        }
        for (const ref of results.references) {
          if (!eventIndex[ref.eventName]) eventIndex[ref.eventName] = { definitions: [], references: [] };
          eventIndex[ref.eventName].references.push(ref);
        }
      } catch (err) { /* skip */ }
    }
    console.log(`CFX Events: Indexed ${Object.keys(eventIndex).length} events`);
  } finally {
    isIndexing = false;
  }
}

function getEventAtPosition(document, position) {
  const line = document.lineAt(position.line).text;

  for (const pattern of ALL_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(line)) !== null) {
      const eventName = match[1];
      const quoteChar = match[0].includes("'") ? "'" : '"';
      const eventStart = line.indexOf(quoteChar + eventName + quoteChar, match.index);
      const startChar = eventStart + 1;
      const endChar = startChar + eventName.length;

      if (position.character >= eventStart && position.character <= endChar + 1) {
        return {
          eventName,
          range: new vscode.Range(position.line, startChar, position.line, endChar),
        };
      }
    }
  }
  return null;
}

/**
 * Definition Provider - Returns all locations to show peek view
 */
class EventDefinitionProvider {
  provideDefinition(document, position) {
    const eventInfo = getEventAtPosition(document, position);
    if (!eventInfo) return null;

    const event = eventIndex[eventInfo.eventName];
    if (!event) return null;

    const allLocations = [];
    const seen = new Set();

    // Add definitions first
    for (const def of event.definitions) {
      const key = `${def.uri.toString()}:${def.line}`;
      if (!seen.has(key)) {
        seen.add(key);
        allLocations.push(new vscode.Location(def.uri, def.range));
      }
    }

    // Add ALL triggers (no limit)
    for (const ref of event.references) {
      const key = `${ref.uri.toString()}:${ref.line}`;
      if (!seen.has(key)) {
        seen.add(key);
        allLocations.push(new vscode.Location(ref.uri, ref.range));
      }
    }

    if (allLocations.length === 0) return null;
    return allLocations;
  }
}

/**
 * Reference Provider
 */
class EventReferenceProvider {
  provideReferences(document, position, context) {
    const eventInfo = getEventAtPosition(document, position);
    if (!eventInfo) return null;

    const event = eventIndex[eventInfo.eventName];
    if (!event) return null;

    const allLocations = [];
    const seen = new Set();

    if (context.includeDeclaration) {
      for (const def of event.definitions) {
        const key = `${def.uri.toString()}:${def.line}`;
        if (!seen.has(key)) {
          seen.add(key);
          allLocations.push(new vscode.Location(def.uri, def.range));
        }
      }
    }

    for (const ref of event.references) {
      const key = `${ref.uri.toString()}:${ref.line}`;
      if (!seen.has(key)) {
        seen.add(key);
        allLocations.push(new vscode.Location(ref.uri, ref.range));
      }
    }

    for (const def of event.definitions) {
      const key = `${def.uri.toString()}:${def.line}`;
      if (!seen.has(key)) {
        seen.add(key);
        allLocations.push(new vscode.Location(def.uri, def.range));
      }
    }

    return allLocations;
  }
}

/**
 * Document Highlight Provider
 */
class EventHighlightProvider {
  provideDocumentHighlights(document, position) {
    const eventInfo = getEventAtPosition(document, position);
    if (!eventInfo) return null;

    const event = eventIndex[eventInfo.eventName];
    if (!event) return null;

    const highlights = [];
    const currentUri = document.uri.toString();

    for (const def of event.definitions) {
      if (def.uri.toString() === currentUri) {
        highlights.push(new vscode.DocumentHighlight(def.range, vscode.DocumentHighlightKind.Write));
      }
    }

    for (const ref of event.references) {
      if (ref.uri.toString() === currentUri) {
        highlights.push(new vscode.DocumentHighlight(ref.range, vscode.DocumentHighlightKind.Read));
      }
    }

    return highlights;
  }
}

/**
 * Hover Provider - Minimal, like VS Code default
 */
class EventHoverProvider {
  provideHover(document, position) {
    const eventInfo = getEventAtPosition(document, position);
    if (!eventInfo) return null;

    const event = eventIndex[eventInfo.eventName];
    if (!event) return null;

    const defCount = event.definitions.length;
    const refCount = event.references.length;

    // Minimal hover - just like function signature
    const markdown = new vscode.MarkdownString();
    markdown.appendCodeblock(`(event) "${eventInfo.eventName}"`, 'lua');
    markdown.appendMarkdown(`${defCount} handler${defCount !== 1 ? 's' : ''}, ${refCount} trigger${refCount !== 1 ? 's' : ''}`);

    return new vscode.Hover(markdown, eventInfo.range);
  }
}

/**
 * Document Link Provider - Highlights full event string on Ctrl+hover
 * Does NOT set target - lets DefinitionProvider handle the click
 */
class EventLinkProvider {
  provideDocumentLinks(document) {
    const links = [];
    const lines = document.getText().split('\n');

    lines.forEach((line, lineIndex) => {
      for (const pattern of ALL_PATTERNS) {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(line)) !== null) {
          const eventName = match[1];
          const quoteChar = match[0].includes("'") ? "'" : '"';
          const eventStart = line.indexOf(quoteChar + eventName + quoteChar, match.index);
          const startChar = eventStart + 1;
          const endChar = startChar + eventName.length;

          const link = new vscode.DocumentLink(
            new vscode.Range(lineIndex, startChar, lineIndex, endChar)
          );
          // No target set - this makes VS Code fall back to DefinitionProvider
          link.tooltip = `${eventName} - Ctrl+Click to see all locations`;
          links.push(link);
        }
      }
    });

    return links;
  }

  // Don't resolve - let DefinitionProvider handle it
  resolveDocumentLink(link) {
    return undefined;
  }
}

function activate(context) {
  console.log('CFX Events extension activated');
  buildIndex();

  const luaSelector = { language: 'lua', scheme: 'file' };

  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider(luaSelector, new EventDefinitionProvider()),
    vscode.languages.registerReferenceProvider(luaSelector, new EventReferenceProvider()),
    vscode.languages.registerHoverProvider(luaSelector, new EventHoverProvider()),
    vscode.languages.registerDocumentHighlightProvider(luaSelector, new EventHighlightProvider()),
    vscode.languages.registerDocumentLinkProvider(luaSelector, new EventLinkProvider()),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('cfx-events.reindex', async () => {
      await buildIndex();
      vscode.window.showInformationMessage(`CFX Events: Indexed ${Object.keys(eventIndex).length} events`);
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((doc) => {
      if (doc.languageId === 'lua') setTimeout(() => buildIndex(), 1000);
    })
  );

  const watcher = vscode.workspace.createFileSystemWatcher('**/*.lua');
  watcher.onDidCreate(() => setTimeout(() => buildIndex(), 1000));
  watcher.onDidDelete(() => setTimeout(() => buildIndex(), 1000));
  watcher.onDidChange(() => setTimeout(() => buildIndex(), 1000));
  context.subscriptions.push(watcher);
}

function deactivate() {
  eventIndex = {};
}

module.exports = { activate, deactivate };