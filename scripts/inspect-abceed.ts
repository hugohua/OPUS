
import fs from 'fs';

const raw = fs.readFileSync('raw_data/abceed.json', 'utf-8');
const data = JSON.parse(raw);

console.log('Root keys:', Object.keys(data));

// Check likely candidates for the list
const possibleLists = Object.keys(data).filter(k => Array.isArray(data[k]));
possibleLists.forEach(k => {
    console.log(`Array "${k}" length:`, data[k].length);
    if (data[k].length > 0) {
        console.log(`Sample item from "${k}":`, JSON.stringify(data[k][0], null, 2));
    }
});
