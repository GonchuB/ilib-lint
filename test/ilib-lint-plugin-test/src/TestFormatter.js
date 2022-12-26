/*
 * TestFormatter.js - test an i18nlint Formatter plugin
 *
 * Copyright © 2022 JEDLSoft
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

import { Formatter } from 'i18nlint-common';

const rainbowColors = [
    91, // R
    43, // O
    93, // Y
    42, // G
    34, // B
    35, // I
    95, // V
];

function rainbow(str) {
    const chars = str.split(/./g);
    let i = -1;
    let colors = chars.map(ch => {
        i = (i + 1) % rainbowColors.length;
        return `\u001B[${rainbowColors[i]}]m${ch}`;
    });
    colors.push("\u001B[33m");
    return colors.join("");
}

class TestFormatter extends Formatter {
    constructor(options) {
        super(options);
        this.name = "formatter-test";
        this.description = "A test formatter that formats results as crazy rainbow strings";
    }

    format(result) {
        if (!result) return;
        let output = "";
        const startColor = (result.severity === "error" ? "\u001B[91m" : "\u001B[33m");
        output += `${result.pathName}${typeof(result.lineNumber) === "number" ? ('(' + result.lineNumber + ')') : ""}:
  ${startColor}${result.description}\u001B[0m\n`;
        if (result.id) {
            output += `  Key: ${result.id}\n`;
        }
        if (result.source) {
            output += `  Source: ${result.source}\n`;
        }
        output += `  ${result.highlight}
  Rule (${result.rule.getName()}): ${result.rule.getDescription()}
`;
        // output ascii terminal escape sequences
        output = output.replace(/<e\d><\/e\d>/g, ">> <<");
        output = output.replace(/<e\d>/g, ">>");
        output = output.replace(/<\/e\d>/g, "<<");

        return rainbow(output);
    }
}

export default TestFormatter;
