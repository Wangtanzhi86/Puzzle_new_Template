'use strict';

exports.load = function () {};
exports.unload = function () {};

// '*' = 所有平台都挂这套钩子；真正做什么由 hooks.js 按 platform 判断
exports.configs = {
  '*': {
    hooks: './hooks',
  },
};
