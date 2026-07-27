// checks whether the string is in the array, and removes it if it exists, or adds it if it doesn't:
export function updateArray(arr, num) {
  const index = arr.indexOf(num);
  if (index > -1) {
      arr.splice(index, 1); // Remove the string if found
  } else {
      arr.push(num); // Add the string if not found
  }
  return arr;
}

export function splitStringAtWordIndex(str, t) {
  const words = str.split(' ');

  if (t < 0 || t >= words.length) {
      return null; // Invalid index
  }

  const beforeT = words.slice(0, t).join(' '); // Words before t's word
  const tWord = words[t];                      // The t's word
  const afterT = words.slice(t + 1).join(' ');  // Words after t's word

  return {
      beforeT: beforeT,
      tWord: tWord,
      afterT: afterT
  };
}

export function splitPerturbationSentence(str) {
  // Find the pattern [word] in the sentence
  const bracketPattern = /\[([^\]]+)\]/;
  const match = str.match(bracketPattern);
  
  if (!match) {
    // If no brackets found, return the original string without highlighting
    return {
      beforeT: str,
      tWord: '',
      afterT: ''
    };
  }
  
  const focusWord = match[1];
  const beforeBracket = str.substring(0, match.index);
  const afterBracket = str.substring(match.index + match[0].length);
  
  return {
    beforeT: beforeBracket,
    tWord: focusWord,
    afterT: afterBracket
  };
}

export function areListsEqual(list1, list2) {
  if (list1.length !== list2.length) {
      return false;
  }
  return list1.every((value, index) => value === list2[index]);
}