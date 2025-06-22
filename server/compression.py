import zlib
from io import BytesIO

class CompressionManager:
    @staticmethod
    def compress(data):
        """Compress data using zlib"""
        return zlib.compress(data)

    @staticmethod
    def decompress(compressed_data):
        """Decompress zlib compressed data"""
        return zlib.decompress(compressed_data)

    @staticmethod
    def compress_diff(old_data, new_data):
        """Compress only the differences between frames"""
        if old_data is None:
            return CompressionManager.compress(new_data)
            
        # Simple byte-level diff (for demonstration)
        # In production, you'd want a more sophisticated diff algorithm
        diff = []
        min_len = min(len(old_data), len(new_data))
        for i in range(min_len):
            if old_data[i] != new_data[i]:
                diff.append((i, new_data[i]))
        
        # For parts beyond the old data length
        if len(new_data) > len(old_data):
            diff.append(('tail', new_data[len(old_data):]))
            
        return diff

    @staticmethod
    def decompress_diff(old_data, diff):
        """Reconstruct data from diff"""
        if not isinstance(diff, list):
            return CompressionManager.decompress(diff)
            
        reconstructed = bytearray(old_data) if old_data else bytearray()
        
        for change in diff:
            if isinstance(change[0], int):  # Byte change
                pos, val = change
                if pos < len(reconstructed):
                    reconstructed[pos] = val
                else:
                    reconstructed.append(val)
            elif change[0] == 'tail':  # Appended data
                reconstructed.extend(change[1])
                
        return bytes(reconstructed)
