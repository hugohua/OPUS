/**
 * 测试 OpenAI 兼容代理，使用Antigravity Tool运行
 * 功能：
 *   验证本地运行的 OpenAI 兼容代理是否正常工作
 *   测试 gemini-3-flash 模型的连接和响应
 * 使用方法：
 *   npx tsx scripts/test-openai-proxy.ts
 */

import OpenAI from "openai";

async function testProxy() {
    console.log("🚀 开始测试 OpenAI 兼容代理...\n");

    const client = new OpenAI({
        baseURL: "http://127.0.0.1:8045/v1",
        apiKey: "sk-6157c3a544da426d8b4c04a953de7425",
    });

    try {
        console.log("📡 发送请求到代理服务器...");
        const startTime = Date.now();

        const response = await client.chat.completions.create({
            model: "gemini-3-flash",
            messages: [{ role: "user", content: "Hello" }],
        });

        const endTime = Date.now();
        const duration = endTime - startTime;

        console.log("\n✅ 请求成功！");
        console.log("─".repeat(50));
        console.log(`📊 响应时间: ${duration}ms`);
        console.log(`🤖 模型: ${response.model}`);
        console.log(`📝 回复内容:\n${response.choices[0].message.content}`);
        console.log("─".repeat(50));

        // 输出完整响应对象（调试用）
        if (process.argv.includes("--verbose")) {
            console.log("\n📋 完整响应:");
            console.log(JSON.stringify(response, null, 2));
        }
    } catch (error) {
        console.error("\n❌ 请求失败！");
        if (error instanceof Error) {
            console.error(`错误信息: ${error.message}`);
            if ("status" in error) {
                console.error(`HTTP 状态码: ${(error as any).status}`);
            }
        } else {
            console.error(error);
        }
        process.exit(1);
    }
}

testProxy();
