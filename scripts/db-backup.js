"use strict";
/**
 * Backup Database to JSON
 *
 * 功能：
 *   将 Vocab 和 UserProgress 表的数据导出为 JSON 文件。
 *   文件保存在 backups/ 目录下，文件名包含时间戳。
 *
 * 使用方法：
 *   npx tsx scripts/db-backup.ts
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var client_1 = require("@prisma/client");
var fs_1 = require("fs");
var path_1 = require("path");
// Load env
try {
    process.loadEnvFile();
}
catch (_a) { }
var prisma = new client_1.PrismaClient();
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var backupDir, timestamp, vocabs, vocabPath, progress, progressPath, users, userPath, articles, articlePath, articleVocabs, articleVocabPath, invitationCodes, invitationCodePath, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('📦 开始备份数据...');
                    backupDir = path_1.default.join(process.cwd(), 'backups');
                    if (!fs_1.default.existsSync(backupDir)) {
                        fs_1.default.mkdirSync(backupDir);
                    }
                    timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 8, 9, 11]);
                    return [4 /*yield*/, prisma.vocab.findMany()];
                case 2:
                    vocabs = _a.sent();
                    vocabPath = path_1.default.join(backupDir, "vocab-".concat(timestamp, ".json"));
                    fs_1.default.writeFileSync(vocabPath, JSON.stringify(vocabs, null, 2));
                    console.log("\u2705 [Vocab] \u5DF2\u5907\u4EFD ".concat(vocabs.length, " \u6761\u8BB0\u5F55\u5230 ").concat(vocabPath));
                    return [4 /*yield*/, prisma.userProgress.findMany()];
                case 3:
                    progress = _a.sent();
                    progressPath = path_1.default.join(backupDir, "progress-".concat(timestamp, ".json"));
                    fs_1.default.writeFileSync(progressPath, JSON.stringify(progress, null, 2));
                    console.log("\u2705 [UserProgress] \u5DF2\u5907\u4EFD ".concat(progress.length, " \u6761\u8BB0\u5F55\u5230 ").concat(progressPath));
                    return [4 /*yield*/, prisma.user.findMany()];
                case 4:
                    users = _a.sent();
                    userPath = path_1.default.join(backupDir, "user-".concat(timestamp, ".json"));
                    fs_1.default.writeFileSync(userPath, JSON.stringify(users, null, 2));
                    console.log("\u2705 [User] \u5DF2\u5907\u4EFD ".concat(users.length, " \u6761\u8BB0\u5F55\u5230 ").concat(userPath));
                    return [4 /*yield*/, prisma.article.findMany()];
                case 5:
                    articles = _a.sent();
                    articlePath = path_1.default.join(backupDir, "article-".concat(timestamp, ".json"));
                    fs_1.default.writeFileSync(articlePath, JSON.stringify(articles, null, 2));
                    console.log("\u2705 [Article] \u5DF2\u5907\u4EFD ".concat(articles.length, " \u6761\u8BB0\u5F55\u5230 ").concat(articlePath));
                    return [4 /*yield*/, prisma.articleVocab.findMany()];
                case 6:
                    articleVocabs = _a.sent();
                    articleVocabPath = path_1.default.join(backupDir, "articleVocab-".concat(timestamp, ".json"));
                    fs_1.default.writeFileSync(articleVocabPath, JSON.stringify(articleVocabs, null, 2));
                    console.log("\u2705 [ArticleVocab] \u5DF2\u5907\u4EFD ".concat(articleVocabs.length, " \u6761\u8BB0\u5F55\u5230 ").concat(articleVocabPath));
                    return [4 /*yield*/, prisma.invitationCode.findMany()];
                case 7:
                    invitationCodes = _a.sent();
                    invitationCodePath = path_1.default.join(backupDir, "invitationCode-".concat(timestamp, ".json"));
                    fs_1.default.writeFileSync(invitationCodePath, JSON.stringify(invitationCodes, null, 2));
                    console.log("\u2705 [InvitationCode] \u5DF2\u5907\u4EFD ".concat(invitationCodes.length, " \u6761\u8BB0\u5F55\u5230 ").concat(invitationCodePath));
                    console.log('\n🎉 所有表备份完成！');
                    return [3 /*break*/, 11];
                case 8:
                    error_1 = _a.sent();
                    console.error('❌ 备份失败:', error_1);
                    return [3 /*break*/, 11];
                case 9: return [4 /*yield*/, prisma.$disconnect()];
                case 10:
                    _a.sent();
                    return [7 /*endfinally*/];
                case 11: return [2 /*return*/];
            }
        });
    });
}
main();
