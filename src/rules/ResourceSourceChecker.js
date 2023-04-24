/*
 * ResourceSourceChecker.js - rule to check if URLs in the source string also
 * appear in the target string
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

import { Result } from 'i18nlint-common';
import DeclarativeResourceRule from './DeclarativeResourceRule.js';
import { stripPlurals } from './utils.js';

/**
 * @class Resource checker class that checks that any regular expressions
 * that matches in the source also appears in the translation.
 */
class ResourceSourceChecker extends DeclarativeResourceRule {
    /**
     * Construct a new regular expression-based resource checker.
     *
     * The options must contain the following required properties:
     *
     * - name - a unique name for this rule
     * - description - a one-line description of what this rule checks for.
     *   Example: "Check that URLs in the source also appear in the target"
     * - note - a one-line note that will be printed on screen when the
     *   check fails. Example: "The URL {matchString} did not appear in the
     *   the target." (Currently, matchString is the only replacement
     *   param that is supported.)
     * - regexps - an array of strings that encode regular expressions to
     *   look for
     * @param {Object} options options as documented above
     * @constructor
     */
    constructor(options) {
        super(options);
    }

    /**
     * @override
     */
    checkString(re, src, file, resource) {
        re.lastIndex = 0;
        let matches = [];
        const strippedSrc = stripPlurals(src);

        // check the target only
        re.lastIndex = 0;
        let match = re.exec(strippedSrc);
        while (match) {
            let value = {
                severity: this.severity,
                id: resource.getKey(),
                rule: this,
                pathName: file,
                highlight: `Source: ${src.substring(0, match.index)}<e0>${match[0]}</e0>${src.substring(match.index+match[0].length)}`,
                description: this.note.replace(/\{matchString\}/g, match[0])
            };
            if (typeof(resource.lineNumber) !== 'undefined') {
                value.lineNumber = resource.lineNumber;
            }
            matches.push(new Result(value));

            match = re.exec(strippedSrc);
        }

        return matches;
    }
}

export default ResourceSourceChecker;
