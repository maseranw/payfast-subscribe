const fs = require('fs');
const path = require('path');

const content = `"use strict";
const esm = require("./index.js");
module.exports = esm.default;
module.exports.buildPayfastRouter = esm.buildPayfastRouter;
`;

fs.writeFileSync(path.join(__dirname, "../dist/cjs.js"), content);
