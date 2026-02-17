export interface DiffPart {
  value: string;
  added?: boolean;
  removed?: boolean;
}

export function computeDiff(oldStr: string, newStr: string): DiffPart[] {
  // Simple word-based or character-based diff logic
  // For now, let's do a line-based diff as it's most useful for JSON/Code
  const oldLines = oldStr.split('\n');
  const newLines = newStr.split('\n');
  const result: DiffPart[] = [];

  let i = 0;
  let j = 0;

  while (i < oldLines.length || j < newLines.length) {
    if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
      result.push({ value: oldLines[i] + '\n' });
      i++;
      j++;
    } else {
      // Find where they match again
      let foundMatch = false;
      for (let k = i + 1; k < oldLines.length; k++) {
        if (oldLines[k] === newLines[j]) {
          // Lines i to k-1 were removed
          for (let m = i; m < k; m++) {
            result.push({ value: oldLines[m] + '\n', removed: true });
          }
          i = k;
          foundMatch = true;
          break;
        }
      }
      
      if (!foundMatch) {
        for (let k = j; k < newLines.length; k++) {
            // Check if this new line exists later in oldLines
            let existsLater = false;
            for(let m = i; m < oldLines.length; m++) {
                if(oldLines[m] === newLines[k]) {
                    existsLater = true;
                    break;
                }
            }
            if(existsLater) {
                // We'll catch this in the next iteration
                break;
            } else {
                result.push({ value: newLines[k] + '\n', added: true });
                j++;
            }
        }
        if (i < oldLines.length && (j >= newLines.length || oldLines[i] !== newLines[j])) {
            result.push({ value: oldLines[i] + '\n', removed: true });
            i++;
        }
      }
    }
  }

  return result;
}
