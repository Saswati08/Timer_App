/***
 * Node External Editor
 *
 * Kevin Gravier <kevin@mrkmg.com>
 * MIT 2018
 */
export declare class LaunchEditorError extends Error {
    originalError: Error;
    constructor(originalError: Error);
}
