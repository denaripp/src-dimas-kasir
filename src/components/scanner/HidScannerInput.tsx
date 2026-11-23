import { useCallback, useEffect, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';

interface HidScannerInputProps {
  /** Aktifkan fokus pasif HID (matikan saat user mengetik di search/nominal tunai atau saat modal terbuka). */
  enabled: boolean;
  onScan: (barcode: string) => void;
}

/**
 * Input tersembunyi penerima scanner eksternal mode HID (Bluetooth / USB OTG)
 * dengan showSoftInputOnFocus={false} agar keyboard virtual Android tidak muncul terus.
 */
export function HidScannerInput({ enabled, onScan }: HidScannerInputProps) {
  const inputRef = useRef<TextInput>(null);
  const [buffer, setBuffer] = useState('');

  const emitBarcode = useCallback(
    (raw: string) => {
      const cleaned = raw.replace(/[\r\n]+/g, '').trim();
      setBuffer('');
      if (cleaned.length >= 2) {
        onScan(cleaned);
      }
    },
    [onScan],
  );

  useEffect(() => {
    if (!enabled) {
      inputRef.current?.blur();
      return;
    }

    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 150);

    return () => clearTimeout(timer);
  }, [enabled]);

  const handleChangeText = (text: string) => {
    if (text.includes('\n') || text.includes('\r')) {
      emitBarcode(text);
      return;
    }
    setBuffer(text);
  };

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: 1,
        height: 1,
        opacity: 0,
        overflow: 'hidden',
      }}
    >
      <TextInput
        ref={inputRef}
        value={buffer}
        onChangeText={handleChangeText}
        onSubmitEditing={() => emitBarcode(buffer)}
        showSoftInputOnFocus={false}
        caretHidden
        blurOnSubmit={false}
        autoCorrect={false}
        autoCapitalize="none"
        importantForAutofill="no"
        accessibilityElementsHidden
      />
    </View>
  );
}
