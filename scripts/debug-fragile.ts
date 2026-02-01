import { db } from '../lib/db';
import { buildSimpleDrill } from '../lib/templates/deterministic-drill';

async function main() {
    const word = await db.vocab.findUnique({
        where: { word: 'fragile' },
    });

    console.log("DB Record for fragile:");
    console.log(JSON.stringify(word, null, 2));

    console.log("\n--- Simulating buildSimpleDrill ---");
    const result = buildSimpleDrill(word as any, "PHRASE");
    console.log(JSON.stringify(result, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await db.$disconnect();
    });
