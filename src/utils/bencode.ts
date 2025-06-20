export class Bencode {
  static encode(data: any): Uint8Array {
    const result: number[] = [];
    
    function encodeValue(value: any): void {
      if (typeof value === 'string') {
        const utf8 = new TextEncoder().encode(value);
        result.push(...new TextEncoder().encode(utf8.length + ':'));
        result.push(...utf8);
      } else if (typeof value === 'number' && Number.isInteger(value)) {
        result.push(...new TextEncoder().encode('i' + value + 'e'));
      } else if (value instanceof Uint8Array) {
        result.push(...new TextEncoder().encode(value.length + ':'));
        result.push(...value);
      } else if (Array.isArray(value)) {
        result.push(108); // 'l'
        value.forEach(encodeValue);
        result.push(101); // 'e'
      } else if (typeof value === 'object' && value !== null) {
        result.push(100); // 'd'
        Object.keys(value).sort().forEach(key => {
          encodeValue(key);
          encodeValue(value[key]);
        });
        result.push(101); // 'e'
      } else {
        throw new Error(`Cannot encode value of type ${typeof value}: ${value}`);
      }
    }
    
    try {
      encodeValue(data);
      return new Uint8Array(result);
    } catch (error) {
      throw new Error(`Bencode encoding failed: ${error.message}`);
    }
  }

  static decode(data: Uint8Array): any {
    if (!data || data.length === 0) {
      throw new Error('Empty data provided for decoding');
    }

    let index = 0;
    
    function decodeValue(): any {
      if (index >= data.length) {
        throw new Error('Unexpected end of data');
      }
      
      const byte = data[index];
      
      if (byte >= 48 && byte <= 57) { // '0'-'9'
        return decodeString();
      } else if (byte === 105) { // 'i'
        return decodeInteger();
      } else if (byte === 108) { // 'l'
        return decodeList();
      } else if (byte === 100) { // 'd'
        return decodeDictionary();
      }
      
      throw new Error(`Invalid bencode data at position ${index}: ${byte} (${String.fromCharCode(byte)})`);
    }
    
    function decodeString(): Uint8Array {
      let lengthStr = '';
      const startIndex = index;
      
      while (index < data.length && data[index] !== 58) { // ':'
        const char = data[index];
        if (char < 48 || char > 57) {
          throw new Error(`Invalid string length character at position ${index}: ${char}`);
        }
        lengthStr += String.fromCharCode(char);
        index++;
      }
      
      if (index >= data.length) {
        throw new Error('Missing colon in string');
      }
      
      if (lengthStr === '') {
        throw new Error('Empty string length');
      }
      
      index++; // skip ':'
      
      const length = parseInt(lengthStr, 10);
      if (isNaN(length) || length < 0) {
        throw new Error(`Invalid string length: ${lengthStr}`);
      }
      
      if (length > 100 * 1024 * 1024) { // 100MB limit for strings
        throw new Error(`String too large: ${length} bytes`);
      }
      
      if (index + length > data.length) {
        throw new Error(`String length ${length} exceeds remaining data ${data.length - index}`);
      }
      
      const result = data.slice(index, index + length);
      index += length;
      return result;
    }
    
    function decodeInteger(): number {
      index++; // skip 'i'
      let numStr = '';
      const startIndex = index;
      
      while (index < data.length && data[index] !== 101) { // 'e'
        const char = data[index];
        if ((char < 48 || char > 57) && char !== 45) { // not '0'-'9' or '-'
          throw new Error(`Invalid integer character at position ${index}: ${char}`);
        }
        numStr += String.fromCharCode(char);
        index++;
      }
      
      if (index >= data.length) {
        throw new Error('Missing end marker for integer');
      }
      
      if (numStr === '' || numStr === '-') {
        throw new Error('Empty or invalid integer');
      }
      
      // Check for leading zeros (not allowed in bencode except for '0')
      if (numStr.length > 1 && numStr[0] === '0') {
        throw new Error('Leading zeros not allowed in integers');
      }
      
      if (numStr.length > 1 && numStr.startsWith('-0')) {
        throw new Error('Negative zero not allowed');
      }
      
      index++; // skip 'e'
      
      const result = parseInt(numStr, 10);
      if (isNaN(result)) {
        throw new Error(`Invalid integer format: ${numStr}`);
      }
      
      // Check for integer overflow
      if (!Number.isSafeInteger(result)) {
        throw new Error(`Integer overflow: ${numStr}`);
      }
      
      return result;
    }
    
    function decodeList(): any[] {
      index++; // skip 'l'
      const result: any[] = [];
      let itemCount = 0;
      
      while (index < data.length && data[index] !== 101) { // 'e'
        if (itemCount > 10000) { // Prevent excessive memory usage
          throw new Error('List too large');
        }
        result.push(decodeValue());
        itemCount++;
      }
      
      if (index >= data.length) {
        throw new Error('Missing end marker for list');
      }
      
      index++; // skip 'e'
      return result;
    }
    
    function decodeDictionary(): Record<string, any> {
      index++; // skip 'd'
      const result: Record<string, any> = {};
      let keyCount = 0;
      let lastKey = '';
      
      while (index < data.length && data[index] !== 101) { // 'e'
        if (keyCount > 1000) { // Prevent excessive memory usage
          throw new Error('Dictionary too large');
        }
        
        const keyBytes = decodeString();
        const key = new TextDecoder('utf-8', { fatal: false }).decode(keyBytes);
        
        // Check key ordering (bencode requires sorted keys)
        if (keyCount > 0 && key <= lastKey) {
          console.warn(`Dictionary keys not properly sorted: ${lastKey} -> ${key}`);
        }
        
        const value = decodeValue();
        result[key] = value;
        lastKey = key;
        keyCount++;
      }
      
      if (index >= data.length) {
        throw new Error('Missing end marker for dictionary');
      }
      
      index++; // skip 'e'
      return result;
    }
    
    try {
      const result = decodeValue();
      if (index !== data.length) {
        console.warn(`Warning: ${data.length - index} bytes remaining after decode`);
      }
      return result;
    } catch (error) {
      throw new Error(`Bencode decode error at position ${index}: ${error.message}`);
    }
  }

  static decodeString(data: Uint8Array): string {
    try {
      // Try UTF-8 decoding first
      return new TextDecoder('utf-8', { fatal: true }).decode(data);
    } catch {
      // Fallback for non-UTF8 data (binary data)
      return new TextDecoder('latin1').decode(data);
    }
  }

  static validateStructure(data: Uint8Array): boolean {
    try {
      this.decode(data);
      return true;
    } catch {
      return false;
    }
  }

  static getDataType(data: Uint8Array, index: number = 0): string {
    if (index >= data.length) return 'unknown';
    
    const byte = data[index];
    
    if (byte >= 48 && byte <= 57) return 'string';
    if (byte === 105) return 'integer';
    if (byte === 108) return 'list';
    if (byte === 100) return 'dictionary';
    
    return 'unknown';
  }
}