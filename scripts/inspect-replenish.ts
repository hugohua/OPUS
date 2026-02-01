
import { db } from '@/lib/db';

async function main() {
    const word = await db.vocab.findFirst({
        where: { word: 'replenish' }
    });
    console.log(JSON.stringify(word, null, 2));
}

main();
