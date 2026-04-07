
const name1 = "Qawā‘id"; // with smart quote U+2018
const name2 = "Qawā'id"; // with straight quote U+0027

console.log("Direct match:", name1.toLowerCase() === name2.toLowerCase());

function normalize(str) {
  return str.normalize('NFC')
    .toLowerCase()
    .replace(/[‘’'“”]/g, "'") // standardize quotes
    .trim();
}

console.log("Normalized match:", normalize(name1) === normalize(name2));

const macron1 = "ā";
const macron2 = "a\u0304"; // a + combining macron
console.log("Macron direct match:", macron1 === macron2);
console.log("Macron normalized match:", macron1.normalize('NFC') === macron2.normalize('NFC'));
