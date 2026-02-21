import { db } from '../lib/db';
import { buildPhraseFallbackDrill } from '../lib/templates/phrase-fallback';

async function main() {
    const word = await db.vocab.findUnique({
        where: { word: 'fragile' },
    });

    console.log("DB Record for fragile:");
    console.log(JSON.stringify(word, null, 2));

    console.log("\n--- Simulating buildSimpleDrill ---");
    const result = buildPhraseFallbackDrill(word as any, "SYNTAX");
    console.log(JSON.stringify(result, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await db.$disconnect();
    });
