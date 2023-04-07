/*
 * Project.js - Represents a particular i18nlint project
 *
 * Copyright © 2022-2023 JEDLSoft
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import path from 'node:path';
import log4js from 'log4js';
import mm from 'micromatch';

import DirItem from './DirItem.js';
import FileType from './FileType.js';

const logger = log4js.getLogger("i18nlint.Project");

const rulesetDefinitions = {
    "resource-check-all": {
        "resource-icu-plurals": true,
        "resource-quote-style": "localeOnly",
        "resource-unique-keys": true,
        "resource-url-match": true,
        "resource-named-params": true
    }
};

const xliffFileTypeDefinition = {
    name: "xliff",
    glob: "**/*.xliff",
    ruleset: [ "resource-check-all" ]
};

const unknownFileTypeDefinition = {
    name: "unknown",
    glob: "**/*"
};

/**
 * @class Represent an i18nlint project.
 *
 * A project is defined as a root directory and a configuration that
 * goes with it that tells the linter how to process files it finds
 * in that root directory. Subprojects can be nested inside of the
 * the top project as indicated by the presence of a new configuration
 * file in the subdirectory.
 */
class Project extends DirItem {
    /**
     * Construct a new project.
     *
     * @param {String} root root directory for this project
     * @param {Object} options properties controlling how this run of the linter
     * works, mostly from the command-line options
     * @param {Object} config contents of a configuration file for this project
     */
    constructor(root, options, config) {
        super(root, options, config);

        this.files = [];

        if (!options || !root || !config || !options.pluginManager) {
            throw "Insufficient params given to Project constructor";
        }

        this.root = root;
        this.options = options;
        this.config = config;
        if (this.config) {
            this.includes = this.config.paths ? Object.keys(this.config.paths) : ["**"];
            this.excludes = config.excludes;
            this.name = config.name;
        }

        this.pluginMgr = this.options.pluginManager;
        const ruleMgr = this.pluginMgr.getRuleManager();
        if (this.config.rules) {
            ruleMgr.add(this.config.rules);
        }
        ruleMgr.addRuleSetDefinitions(rulesetDefinitions);
        if (this.config.rulesets) {
            ruleMgr.addRuleSetDefinitions(this.config.rulesets);
        }
        if (this.config.formatters) {
            const fmtMgr = this.pluginMgr.getFormatterManager();
            fmtMgr.add(this.config.formatters);
        }

        this.filetypes = {
            "xliff": new FileType({project: this, ...xliffFileTypeDefinition}),
            "unknown": new FileType({project: this, ...unknownFileTypeDefinition})
        };
        if (this.config.filetypes) {
            for (let ft in this.config.filetypes) {
                this.filetypes[ft] = new FileType({
                    name: ft,
                    project: this,
                    ...this.config.filetypes[ft]
                });
            }
        }
        if (this.config.paths) {
            this.mappings = this.config.paths;
            for (let glob in this.mappings) {
                if (typeof(this.mappings[glob]) === 'object') {
                    // this is an "on-the-fly" file type
                    this.filetypes[glob] = new FileType({
                        name: glob,
                        project: this,
                        ...this.mappings[glob]
                    });
                }
            }
        }
    }

    /**
     * Initialize this project. This returns a promise to load the
     * plugins and initializes them.
     *
     * @returns {Promise} a promise to initialize the project
     * @accept {boolean} true when everything was initialized correct
     * @reject the initialization failed
     */
    init() {
        let promise = Promise.resolve(true);

        if (this.config.plugins) {
            promise = promise.then(() => {
                return this.pluginMgr.load(this.config.plugins);
            });
        }

        // initialize any projects or files that have an init method.
        this.files.forEach(file => {
            if (typeof(file.init) === 'function') {
                promise = promise.then(() => {
                    return file.init();
                });
            }
        });

        return promise;
    }

    /**
     * Get the unique name of this project.
     * @returns {String} the unique name of this project.
     */
    getName() {
        return this.name;
    }

    /**
     * Return the root directory for this project.
     * @returns {String} the path to the root directory of this project
     */
    getRoot() {
        return this.root;
    }

    /**
     * Return the includes list for this project.
     * @returns {Array.<String>} the includes for this project
     */
    getIncludes() {
        return this.includes;
    }

    /**
     * Return the excludes list for this project.
     * @returns {Array.<String>} the excludes for this project
     */
    getExcludes() {
        return this.excludes;
    }

    /**
     * Return the options for this project.
     * @returns {Array.<String>} the options for this project
     */
    getOptions() {
        return this.options;
    }

    /**
     * Return the list of global locales for this project.
     * @returns {Array.<String>} the list of global locales for this project
     */
    getLocales() {
        return this.options.locales || this.config.locales;
    }

    /**
     * Return the plugin manager for this project.
     * @returns {PluginManager} the plugin manager for this project
     */
    getPluginManager() {
        return this.options.pluginManager;
    }

    /**
     * Return the parser manager for this project.
     * @returns {ParserManager} the parser manager for this project
     */
    getParserManager() {
        const pluginMgr = this.options.pluginManager;
        return pluginMgr.getParserManager();
    }

    /**
     * Return the rule manager for this project.
     * @returns {RuleManager} the rule manager for this project
     */
    getRuleManager() {
        const pluginMgr = this.options.pluginManager;
        return pluginMgr.getRuleManager();
    }

    /**
     * Return the named file type definition. Projects have two
     * default file types that are always defined for every project:
     * "xliff", and "unknown".
     *
     * - xliff - handles all *.xliff files using the XliffParser.
     * It uses the default resources rule set to perform all regular
     * resource checks.
     * - unknown - handles all file types that are not otherwise
     * matched. It does not perform any rule checks on any file.
     *
     * @param {String} name the name or the glob expression used to
     * identify the requested file type
     * @returns {FileType} the requested file type, or undefined if
     * there is no such file type
     */
    getFileType(name) {
        
    }

    /**
     * Using the path mappings, find the file type that applies for
     * the given path. If no mappings apply, the "unkown" file type
     * will be returned.
     *
     * @param {String} pathName the path to the file to test
     * @returns {FileType} the file type instance that applies to
     * the given file.
     */
    getFileTypeForPath(pathName) {
        pathName = path.normalize(pathName);
        for (let glob in this.mappings) {
            if (mm.isMatch(pathName, glob)) {
                // if it is a string, it names the file type. If it is
                // something else, then it is an on-the-fly file type
                // definition
                const name = typeof(this.mappings[glob]) === 'string' ?
                    this.mappings[glob] :
                    glob;
                return this.filetypes[name] || this.filetypes.unknown;
            }
        }
        // default: we don't know what this type of file is!
        return this.filetypes.unknown;
    }

    getRuleSet(glob) {
        if (this.config.paths && this.config.paths[glob]) {
            const rules = this.config.paths[glob].rules;
        }
    }

    getConfig() {
        return this.config;
    }

    getSettings(glob) {
        return (this.config.paths && this.config.paths[glob]) || {};
    }

    /**
     * Add a directory item to this project.
     *
     * @param {DirItem} item directory item to add
     */
    add(item) {
        this.files.push(item);
    }

    /**
     * Return all directory items in this project.
     * @returns {Array.<DirItem>} the directory items in this project.
     */
    get() {
        return this.files;
    }

    /**
     * Find all issues with the files located within this project and
     * return them.
     *
     * @returns {Array.<Result>} a list of results
     */
    findIssues(ruleset, locales) {
        return this.files.map(file => {
            logger.trace(`Examining ${file.filePath}`);

            file.parse();
            return file.findIssues(locales);
        }).flat();
    }

    clear() {
        this.files = [];
    }
};

export default Project;