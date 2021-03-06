"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const ts = __importStar(require("typescript"));
const util_1 = require("../util");
const tsutils_1 = require("tsutils");
const eslint_utils_1 = require("eslint-utils");
exports.default = util_1.createRule({
    name: 'switch-exhaustiveness-check',
    meta: {
        type: 'suggestion',
        docs: {
            description: 'Exhaustiveness checking in switch with union type',
            category: 'Best Practices',
            recommended: false,
            requiresTypeChecking: true,
        },
        schema: [],
        messages: {
            switchIsNotExhaustive: 'Switch is not exhaustive. Cases not matched: {{missingBranches}}',
            addMissingCases: 'Add branches for missing cases',
        },
    },
    defaultOptions: [],
    create(context) {
        const sourceCode = context.getSourceCode();
        const service = util_1.getParserServices(context);
        const checker = service.program.getTypeChecker();
        function getNodeType(node) {
            const tsNode = service.esTreeNodeToTSNodeMap.get(node);
            return util_1.getConstrainedTypeAtLocation(checker, tsNode);
        }
        function fixSwitch(fixer, node, missingBranchTypes) {
            const lastCase = node.cases.length > 0 ? node.cases[node.cases.length - 1] : null;
            const caseIndent = lastCase
                ? ' '.repeat(lastCase.loc.start.column)
                : // if there are no cases, use indentation of the switch statement
                    // and leave it to user to format it correctly
                    ' '.repeat(node.loc.start.column);
            const missingCases = [];
            for (const missingBranchType of missingBranchTypes) {
                // While running this rule on checker.ts of TypeScript project
                // the fix introduced a compiler error due to:
                //
                // type __String = (string & {
                //         __escapedIdentifier: void;
                //     }) | (void & {
                //         __escapedIdentifier: void;
                //     }) | InternalSymbolName;
                //
                // The following check fixes it.
                if (missingBranchType.isIntersection()) {
                    continue;
                }
                const caseTest = checker.typeToString(missingBranchType);
                const errorMessage = `Not implemented yet: ${caseTest} case`;
                missingCases.push(`case ${caseTest}: { throw new Error('${errorMessage}') }`);
            }
            const fixString = missingCases
                .map(code => `${caseIndent}${code}`)
                .join('\n');
            if (lastCase) {
                return fixer.insertTextAfter(lastCase, `\n${fixString}`);
            }
            // there were no existing cases
            const openingBrace = sourceCode.getTokenAfter(node.discriminant, eslint_utils_1.isOpeningBraceToken);
            const closingBrace = sourceCode.getTokenAfter(node.discriminant, eslint_utils_1.isClosingBraceToken);
            return fixer.replaceTextRange([openingBrace.range[0], closingBrace.range[1]], ['{', fixString, `${caseIndent}}`].join('\n'));
        }
        function checkSwitchExhaustive(node) {
            const discriminantType = getNodeType(node.discriminant);
            if (discriminantType.isUnion()) {
                const unionTypes = tsutils_1.unionTypeParts(discriminantType);
                const caseTypes = new Set();
                for (const switchCase of node.cases) {
                    if (switchCase.test === null) {
                        // Switch has 'default' branch - do nothing.
                        return;
                    }
                    caseTypes.add(getNodeType(switchCase.test));
                }
                const missingBranchTypes = unionTypes.filter(unionType => !caseTypes.has(unionType));
                if (missingBranchTypes.length === 0) {
                    // All cases matched - do nothing.
                    return;
                }
                context.report({
                    node: node.discriminant,
                    messageId: 'switchIsNotExhaustive',
                    data: {
                        missingBranches: missingBranchTypes
                            .map(missingType => tsutils_1.isTypeFlagSet(missingType, ts.TypeFlags.ESSymbolLike)
                            ? `typeof ${missingType.symbol.escapedName}`
                            : checker.typeToString(missingType))
                            .join(' | '),
                    },
                    suggest: [
                        {
                            messageId: 'addMissingCases',
                            fix(fixer) {
                                return fixSwitch(fixer, node, missingBranchTypes);
                            },
                        },
                    ],
                });
            }
        }
        return {
            SwitchStatement: checkSwitchExhaustive,
        };
    },
});
//# sourceMappingURL=switch-exhaustiveness-check.js.map