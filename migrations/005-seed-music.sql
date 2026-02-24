-- Seed existing album + track data
INSERT OR IGNORE INTO albums (slug, title, artist, type, year, gradient, sort_order, is_published)
VALUES
    ('infinite-loop', 'Infinite Loop', 'Danny Infinity', 'Album', 2026, 'gradient-1', 1, 1),
    ('after-dark', 'After Dark EP', 'Danny Infinity', 'EP', 2025, 'gradient-2', 2, 1),
    ('sound-design', 'Sound Design Vol. 1', 'Danny Infinity', 'Album', 2025, 'gradient-3', 3, 1),
    ('renee-single', 'ice on the ground in minneapolis (Renee)', 'Danny Infinity', 'Single', 2026, 'gradient-4', 4, 1),
    ('beat-tape', 'Beat Tape 001', 'Danny Infinity', 'Beat Tape', 2024, 'gradient-5', 5, 1),
    ('frequencies', 'Frequencies', 'Danny Infinity', 'Album', 2024, 'gradient-6', 6, 1);

-- Infinite Loop tracks
INSERT OR IGNORE INTO tracks (album_id, title, duration, audio_r2_key, track_number, is_published)
VALUES
    (1, 'ice on the ground in minneapolis (Renee)', '4:32', NULL, 1, 1),
    (1, 'Midnight Protocol', '4:21', NULL, 2, 1),
    (1, 'Digital Rain', '3:58', NULL, 3, 1),
    (1, 'Cipher', '5:12', NULL, 4, 1),
    (1, 'Ghost Signal', '3:34', NULL, 5, 1),
    (1, 'Neon Pulse', '4:05', NULL, 6, 1),
    (1, 'Zero Day', '3:47', NULL, 7, 1);

-- After Dark EP tracks
INSERT OR IGNORE INTO tracks (album_id, title, duration, audio_r2_key, track_number, is_published)
VALUES
    (2, 'Shadowcast', '3:45', NULL, 1, 1),
    (2, 'Wavelength', '4:18', NULL, 2, 1),
    (2, 'Static Memory', '3:22', NULL, 3, 1),
    (2, 'Drift Mode', '5:01', NULL, 4, 1);

-- Sound Design Vol. 1 tracks
INSERT OR IGNORE INTO tracks (album_id, title, duration, audio_r2_key, track_number, is_published)
VALUES
    (3, 'Texture I', '2:30', NULL, 1, 1),
    (3, 'Atmosphere', '3:45', NULL, 2, 1),
    (3, 'Granular', '4:12', NULL, 3, 1),
    (3, 'Synthesis', '3:08', NULL, 4, 1),
    (3, 'Resonance', '5:33', NULL, 5, 1);

-- Renee Single
INSERT OR IGNORE INTO tracks (album_id, title, duration, audio_r2_key, track_number, is_published)
VALUES
    (4, 'ice on the ground in minneapolis (Renee)', '4:32', NULL, 1, 1);

-- Beat Tape 001 tracks
INSERT OR IGNORE INTO tracks (album_id, title, duration, audio_r2_key, track_number, is_published)
VALUES
    (5, 'Loop #1', '2:10', NULL, 1, 1),
    (5, 'Loop #2', '1:55', NULL, 2, 1),
    (5, 'Loop #3', '2:30', NULL, 3, 1),
    (5, 'Loop #4', '2:15', NULL, 4, 1),
    (5, 'Loop #5', '1:48', NULL, 5, 1),
    (5, 'Loop #6', '2:40', NULL, 6, 1);

-- Frequencies tracks
INSERT OR IGNORE INTO tracks (album_id, title, duration, audio_r2_key, track_number, is_published)
VALUES
    (6, 'Low End Theory', '3:55', NULL, 1, 1),
    (6, 'Harmonic', '4:22', NULL, 2, 1),
    (6, 'Sub Bass', '3:10', NULL, 3, 1),
    (6, 'Overtone', '4:45', NULL, 4, 1),
    (6, 'White Noise', '3:30', NULL, 5, 1);
