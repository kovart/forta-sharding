"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.retry = exports.delay = void 0;
const delay = (ms) => new Promise((res) => setTimeout(res, ms));
exports.delay = delay;
function retry(fn, opts) {
    return __awaiter(this, void 0, void 0, function* () {
        const { attempts = 3, wait = 15 * 1000 } = opts || {};
        let attempt = 0;
        // eslint-disable-next-line no-constant-condition
        while (true) {
            try {
                return yield fn();
            }
            catch (e) {
                // eslint-disable-next-line no-console
                console.error(`Attempt (${attempt}/${attempts}):`, { error: e });
                if (attempt >= attempts) {
                    throw e;
                }
                attempt++;
                yield (0, exports.delay)(wait);
            }
        }
    });
}
exports.retry = retry;
//# sourceMappingURL=utils.js.map