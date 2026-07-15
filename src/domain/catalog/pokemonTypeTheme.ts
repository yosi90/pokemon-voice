export interface PokemonTypeTheme {
  primaryType: string;
  secondaryType?: string;
  primary: string;
  secondary: string;
  glow: string;
  motif: string;
}

const TYPE_COLORS: Record<string, { primary: string; secondary: string; glow: string; motif: string }> = {
  normal: { primary: '#a8a77a', secondary: '#68684e', glow: 'rgba(168, 167, 122, .34)', motif: 'rings' },
  fire: { primary: '#ee8130', secondary: '#9c3c14', glow: 'rgba(238, 129, 48, .42)', motif: 'flame' },
  water: { primary: '#6390f0', secondary: '#2454b8', glow: 'rgba(99, 144, 240, .42)', motif: 'sea' },
  electric: { primary: '#f7d02c', secondary: '#9b7910', glow: 'rgba(247, 208, 44, .44)', motif: 'bolts' },
  grass: { primary: '#7ac74c', secondary: '#34711c', glow: 'rgba(122, 199, 76, .4)', motif: 'leaves' },
  ice: { primary: '#96d9d6', secondary: '#397f8c', glow: 'rgba(150, 217, 214, .4)', motif: 'frost' },
  fighting: { primary: '#c22e28', secondary: '#681512', glow: 'rgba(194, 46, 40, .4)', motif: 'fists' },
  poison: { primary: '#a33ea1', secondary: '#5e205d', glow: 'rgba(163, 62, 161, .4)', motif: 'bubbles' },
  ground: { primary: '#e2bf65', secondary: '#8b6825', glow: 'rgba(226, 191, 101, .38)', motif: 'quake' },
  flying: { primary: '#a98ff3', secondary: '#5d47a1', glow: 'rgba(169, 143, 243, .4)', motif: 'currents' },
  psychic: { primary: '#f95587', secondary: '#9c1f4b', glow: 'rgba(249, 85, 135, .42)', motif: 'waves' },
  bug: { primary: '#a6b91a', secondary: '#5c6810', glow: 'rgba(166, 185, 26, .38)', motif: 'web' },
  rock: { primary: '#b6a136', secondary: '#6c5d17', glow: 'rgba(182, 161, 54, .38)', motif: 'mountains' },
  ghost: { primary: '#735797', secondary: '#35244f', glow: 'rgba(115, 87, 151, .46)', motif: 'eyes' },
  dragon: { primary: '#6f35fc', secondary: '#32118d', glow: 'rgba(111, 53, 252, .46)', motif: 'scales' },
  dark: { primary: '#705746', secondary: '#30221b', glow: 'rgba(112, 87, 70, .42)', motif: 'shadows' },
  steel: { primary: '#b7b7ce', secondary: '#5f607d', glow: 'rgba(183, 183, 206, .4)', motif: 'plates' },
  fairy: { primary: '#d685ad', secondary: '#8d3e68', glow: 'rgba(214, 133, 173, .42)', motif: 'gems' },
  unknown: { primary: '#7b8494', secondary: '#343a45', glow: 'rgba(123, 132, 148, .32)', motif: 'classified' },
};

export function getPokemonTypeTheme(types: readonly string[]): PokemonTypeTheme {
  const primaryType = types[0] && TYPE_COLORS[types[0]] ? types[0] : 'unknown';
  const secondaryType = types[1] && TYPE_COLORS[types[1]] ? types[1] : undefined;
  const primaryTheme = TYPE_COLORS[primaryType];
  const accentTheme = secondaryType ? TYPE_COLORS[secondaryType] : primaryTheme;

  return {
    primaryType,
    secondaryType,
    primary: primaryTheme.primary,
    secondary: accentTheme.secondary,
    glow: primaryTheme.glow,
    motif: primaryTheme.motif,
  };
}
