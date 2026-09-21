import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Field, MessageBanner } from '@/components/ui';
import { getCountryOptions, searchCities, searchInstitutions, type CityOption, type CountryOption, type InstitutionOption } from '@/services/referenceData';
import { colors, radius, spacing } from '@/theme/tokens';

type CountryProps = { label: string; value: CountryOption | null; onSelect: (country: CountryOption) => void };

export function CountrySelect({ label, value, onSelect }: CountryProps) {
  const [query, setQuery] = useState(value?.name ?? '');
  const [open, setOpen] = useState(!value);
  const options = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return getCountryOptions('en').filter((country) => !needle || country.name.toLocaleLowerCase().includes(needle) || country.code.toLocaleLowerCase() === needle).slice(0, 8);
  }, [query]);

  return <View style={styles.wrap}>
    <Field label={label} autoCorrect={false} value={query} placeholder="Search country" onFocus={() => setOpen(true)} onChangeText={(text) => { setQuery(text); setOpen(true); }} />
    {open && options.length ? <View accessibilityRole="list" style={styles.results}>{options.map((country) => <Result
      key={country.code} title={country.name} subtitle={country.code} onPress={() => { onSelect(country); setQuery(country.name); setOpen(false); }}
    />)}</View> : null}
  </View>;
}

export function InstitutionSelect({ value, countryCode, onSelect, onClear }: {
  value: InstitutionOption | null; countryCode?: string; onSelect: (institution: InstitutionOption) => void; onClear: () => void;
}) {
  const [query, setQuery] = useState(value?.name ?? '');
  const [results, setResults] = useState<InstitutionOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const request = useRef(0);

  useEffect(() => {
    const sequence = ++request.current;
    const trimmed = query.trim();
    if (value?.name === trimmed || trimmed.length < 2) return;
    const timer = setTimeout(() => {
      setLoading(true); setError('');
      void searchInstitutions(trimmed, countryCode).then((result) => {
        if (sequence !== request.current) return;
        setResults(result.results); setError(result.error ?? ''); setLoading(false);
      });
    }, 400);
    return () => {
      clearTimeout(timer);
      if (request.current === sequence) request.current += 1;
    };
  }, [countryCode, query, value?.name]);

  return <View style={styles.wrap}>
    <Field label="Institution or research organization" autoCorrect={false} maxLength={100} value={query} placeholder="Start typing the official name" onChangeText={(text) => { setQuery(text); setError(''); if (text.trim().length < 2) { setLoading(false); setResults([]); } if (value && text !== value.name) onClear(); }} />
    {loading ? <ActivityIndicator accessibilityLabel="Searching institutions" color={colors.primary} /> : null}
    {error ? <MessageBanner message={error} /> : null}
    {!loading && query.trim().length >= 2 && !value && !error && results.length === 0 ? <Text style={styles.empty}>No verified organizations found. Try another spelling or use the unlisted option.</Text> : null}
    {results.length ? <View accessibilityRole="list" style={styles.results}>{results.map((item) => <Result
      key={item.id} title={item.name} subtitle={[item.city, item.countryName].filter(Boolean).join(', ')} onPress={() => { request.current += 1; setLoading(false); onSelect(item); setQuery(item.name); setResults([]); }}
    />)}</View> : null}
    {value ? <Text style={styles.verified}>Verified organization · ROR</Text> : null}
  </View>;
}

export function CitySelect({ label, value, countryCode, onSelect, onClear }: {
  label: string; value: CityOption | null; countryCode: string; onSelect: (city: CityOption) => void; onClear: () => void;
}) {
  const [query, setQuery] = useState(value?.name ?? '');
  const [results, setResults] = useState<CityOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const request = useRef(0);

  useEffect(() => {
    const sequence = ++request.current;
    const trimmed = query.trim();
    if (!countryCode || value?.name === trimmed || trimmed.length < 2) return;
    const timer = setTimeout(() => {
      setLoading(true); setError('');
      void searchCities(trimmed, countryCode).then((result) => {
        if (sequence !== request.current) return;
        setResults(result.results); setError(result.error ?? ''); setLoading(false);
      });
    }, 400);
    return () => {
      clearTimeout(timer);
      if (request.current === sequence) request.current += 1;
    };
  }, [countryCode, query, value?.name]);

  return <View style={styles.wrap}>
    <Field label={label} editable={Boolean(countryCode)} autoCorrect={false} maxLength={100} value={query} placeholder={countryCode ? 'Search city' : 'Choose a country first'} onChangeText={(text) => { setQuery(text); setError(''); if (text.trim().length < 2) { setLoading(false); setResults([]); } if (value && text !== value.name) onClear(); }} />
    {loading ? <ActivityIndicator accessibilityLabel="Searching cities" color={colors.primary} /> : null}
    {error ? <MessageBanner message={error} /> : null}
    {!loading && query.trim().length >= 2 && !value && !error && results.length === 0 ? <Text style={styles.empty}>No city found in the selected country.</Text> : null}
    {results.length ? <View accessibilityRole="list" style={styles.results}>{results.map((item) => <Result key={item.id} title={item.name} subtitle={[item.admin1, item.countryName].filter(Boolean).join(', ')} onPress={() => { request.current += 1; setLoading(false); onSelect(item); setQuery(item.name); setResults([]); }} />)}</View> : null}
    {value ? <Text style={styles.verified}>Verified city · GeoNames</Text> : null}
  </View>;
}

function Result({ title, subtitle, onPress }: { title: string; subtitle: string; onPress: () => void }) {
  return <Pressable accessibilityLabel={`Choose ${title}`} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.result, pressed && styles.pressed]}>
    <Text style={styles.title}>{title}</Text>{subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
  </Pressable>;
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs, minWidth: 0 }, results: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surface },
  result: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, minHeight: 50, justifyContent: 'center' },
  pressed: { backgroundColor: colors.primarySoft }, title: { color: colors.ink, fontWeight: '700' }, subtitle: { color: colors.inkMuted, fontSize: 12, marginTop: 2 },
  empty: { color: colors.inkMuted, fontSize: 12, lineHeight: 18 }, verified: { color: colors.primaryDark, fontSize: 12, fontWeight: '700' },
});
