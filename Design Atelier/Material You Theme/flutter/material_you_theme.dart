// Material You Design Theme for Flutter apps (company default since 2026-10-14).
//
// Setup (see THEME.md):
//   1. Copy this file + dist/flutter/material_you_tokens.dart into lib/theme/.
//   2. Copy fonts/ttf/*.ttf into assets/fonts/ and add the `fonts:` block from THEME.md to pubspec.yaml.
//   3. MaterialApp(theme: MaterialYouTheme.light(), darkTheme: MaterialYouTheme.dark(), ...)
//
// Looping motion widgets: MuMorphShape, MuLoop (spin / float / wobble / breathe), MuDriftBackground.
// All loops stop when the OS "remove animations" setting is on (MediaQuery.disableAnimations)
// and pause when the route is not visible (TickerMode).
import 'dart:math' as math;

import 'package:flutter/material.dart';

import 'material_you_tokens.dart';

class MaterialYouTheme {
  MaterialYouTheme._();

  static ThemeData light() => _build(MaterialYouTokens.light);
  static ThemeData dark() => _build(MaterialYouTokens.dark);

  static ThemeData _build(ColorScheme c) {
    const t = MaterialYouTokens.fontBody;
    const d = MaterialYouTokens.fontDisplay;
    // Fraunces: SOFT 100 + WONK 1 + low optical size = the chunky retro look from the mood board.
    const soft = [FontVariation('SOFT', 100), FontVariation('WONK', 1), FontVariation('opsz', 30)];
    TextStyle disp(double size, double h, FontWeight w, double tracking) => TextStyle(
        fontFamily: d, fontSize: size, height: h, fontWeight: w, letterSpacing: size * tracking,
        fontVariations: [...soft, FontVariation('wght', w.value.toDouble())]);
    TextStyle body(double size, double h, FontWeight w) =>
        TextStyle(fontFamily: t, fontSize: size, height: h, fontWeight: w);

    final text = TextTheme(
      displayLarge: disp(56, 1.05, FontWeight.w900, -0.02),
      displayMedium: disp(40, 1.1, FontWeight.w900, -0.015),
      displaySmall: disp(32, 1.15, FontWeight.w800, -0.01),
      headlineLarge: disp(28, 1.2, FontWeight.w700, 0),
      headlineMedium: disp(24, 1.25, FontWeight.w700, 0),
      headlineSmall: disp(20, 1.3, FontWeight.w700, 0),
      titleLarge: body(20, 1.3, FontWeight.w700),
      titleMedium: body(16, 1.4, FontWeight.w600),
      titleSmall: body(14, 1.4, FontWeight.w600),
      bodyLarge: body(16, 1.5, FontWeight.w400),
      bodyMedium: body(14, 1.5, FontWeight.w400),
      bodySmall: body(12, 1.45, FontWeight.w400),
      labelLarge: body(14, 1.3, FontWeight.w700),
      labelMedium: body(12, 1.3, FontWeight.w600),
      labelSmall: body(11, 1.3, FontWeight.w600),
    ).apply(bodyColor: c.onSurface, displayColor: c.onSurface);

    const pill = StadiumBorder();
    RoundedRectangleBorder r(double v) => RoundedRectangleBorder(borderRadius: BorderRadius.circular(v));
    const btnPad = EdgeInsets.symmetric(horizontal: 24);
    const btnSize = Size(64, 44);

    return ThemeData(
      useMaterial3: true,
      colorScheme: c,
      scaffoldBackgroundColor: c.surface,
      fontFamily: t,
      textTheme: text,
      visualDensity: VisualDensity.standard,
      splashFactory: InkSparkle.splashFactory,
      filledButtonTheme: FilledButtonThemeData(
          style: FilledButton.styleFrom(shape: pill, padding: btnPad, minimumSize: btnSize, textStyle: text.labelLarge)),
      elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(shape: pill, padding: btnPad, minimumSize: btnSize, textStyle: text.labelLarge)),
      outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(
              shape: pill, padding: btnPad, minimumSize: btnSize, textStyle: text.labelLarge,
              side: BorderSide(color: c.outline, width: 2))),
      textButtonTheme: TextButtonThemeData(style: TextButton.styleFrom(shape: pill, textStyle: text.labelLarge)),
      floatingActionButtonTheme: FloatingActionButtonThemeData(
          shape: r(MaterialYouTokens.radiusLg),
          backgroundColor: c.primaryContainer,
          foregroundColor: c.onPrimaryContainer),
      cardTheme: CardThemeData(
          shape: r(MaterialYouTokens.radiusLg), color: c.surfaceContainerLow, elevation: 1, margin: EdgeInsets.zero),
      chipTheme: ChipThemeData(shape: pill, labelStyle: text.labelLarge, side: BorderSide.none,
          backgroundColor: c.surfaceContainerHigh, selectedColor: c.secondaryContainer),
      dialogTheme: DialogThemeData(shape: r(MaterialYouTokens.radiusXl), backgroundColor: c.surfaceContainerHigh),
      bottomSheetTheme: BottomSheetThemeData(
          shape: const RoundedRectangleBorder(
              borderRadius: BorderRadius.vertical(top: Radius.circular(MaterialYouTokens.radiusXl))),
          backgroundColor: c.surfaceContainerLow,
          showDragHandle: true),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: c.surfaceContainerLowest,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(MaterialYouTokens.radiusMd),
            borderSide: BorderSide(color: c.outlineVariant, width: 2)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(MaterialYouTokens.radiusMd),
            borderSide: BorderSide(color: c.outlineVariant, width: 2)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(MaterialYouTokens.radiusMd),
            borderSide: BorderSide(color: c.primary, width: 2)),
      ),
      navigationBarTheme: NavigationBarThemeData(
          backgroundColor: c.surfaceContainer, indicatorColor: c.secondaryContainer, indicatorShape: pill),
      snackBarTheme: SnackBarThemeData(
          behavior: SnackBarBehavior.floating, shape: r(MaterialYouTokens.radiusMd),
          backgroundColor: c.inverseSurface, contentTextStyle: text.bodyMedium?.copyWith(color: c.onInverseSurface)),
      switchTheme: const SwitchThemeData(),
      pageTransitionsTheme: const PageTransitionsTheme(builders: {
        TargetPlatform.android: PredictiveBackPageTransitionsBuilder(),
      }),
    );
  }
}

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

/// Path for a library shape ('cookie', 'flower', 'clover', 'sunny', 'burst', ...), or a
/// morph between two of them at [t] (0..1). Every shape has the same sample count.
Path muShapePath(Size size, String from, {String? to, double t = 0, double rotation = 0}) {
  final a = MaterialYouTokens.shapes[from]!;
  final b = MaterialYouTokens.shapes[to ?? from]!;
  final n = a.length;
  final cx = size.width / 2, cy = size.height / 2, rad = math.min(cx, cy);
  final pts = List<Offset>.generate(n, (i) {
    final k = a[i] + (b[i] - a[i]) * t;
    final ang = i / n * 2 * math.pi - math.pi / 2 + rotation;
    return Offset(cx + math.cos(ang) * rad * k, cy + math.sin(ang) * rad * k);
  });
  // Closed Catmull-Rom spline through the samples -> smooth outline.
  final p = Path()..moveTo(pts[0].dx, pts[0].dy);
  for (var i = 0; i < n; i++) {
    final p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    final c1 = p1 + (p2 - p0) / 6, c2 = p2 - (p3 - p1) / 6;
    p.cubicTo(c1.dx, c1.dy, c2.dx, c2.dy, p2.dx, p2.dy);
  }
  return p..close();
}

/// Clip any child to a library shape (e.g. an avatar in a cookie).
class MuShapeClipper extends CustomClipper<Path> {
  const MuShapeClipper(this.shape);
  final String shape;
  @override
  Path getClip(Size size) => muShapePath(size, shape);
  @override
  bool shouldReclip(MuShapeClipper old) => old.shape != shape;
}

/// A static filled library shape.
class MuShape extends StatelessWidget {
  const MuShape(this.shape, {super.key, this.size = 96, this.color, this.child});
  final String shape;
  final double size;
  final Color? color;
  final Widget? child;
  @override
  Widget build(BuildContext context) => SizedBox.square(
        dimension: size,
        child: CustomPaint(
          painter: _ShapePainter(shape, shape, 0, 0, color ?? Theme.of(context).colorScheme.primary),
          child: child == null ? null : Center(child: child),
        ),
      );
}

class _ShapePainter extends CustomPainter {
  _ShapePainter(this.from, this.to, this.t, this.rotation, this.color);
  final String from, to;
  final double t, rotation;
  final Color color;
  @override
  void paint(Canvas canvas, Size size) =>
      canvas.drawPath(muShapePath(size, from, to: to, t: t, rotation: rotation), Paint()..color = color..isAntiAlias = true);
  @override
  bool shouldRepaint(_ShapePainter o) => o.t != t || o.rotation != rotation || o.from != from || o.color != color;
}

bool _motionOff(BuildContext context) => MediaQuery.maybeDisableAnimationsOf(context) ?? false;

/// Continuously morphs through [sequence] while slowly rotating. The signature loop of the theme.
class MuMorphShape extends StatefulWidget {
  const MuMorphShape({
    super.key,
    this.sequence = const ['cookie', 'flower', 'clover', 'sunny', 'circle'],
    this.size = 160,
    this.color,
    this.period = MaterialYouTokens.loopMorph,
    this.spin = true,
    this.child,
  });
  final List<String> sequence;
  final double size;
  final Color? color;
  final Duration period;
  final bool spin;
  final Widget? child;
  @override
  State<MuMorphShape> createState() => _MuMorphShapeState();
}

class _MuMorphShapeState extends State<MuMorphShape> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: widget.period);

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _motionOff(context) ? _c.stop() : _c.repeat();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final color = widget.color ?? Theme.of(context).colorScheme.primary;
    final seq = widget.sequence;
    return SizedBox.square(
      dimension: widget.size,
      child: AnimatedBuilder(
        animation: _c,
        builder: (context, child) {
          final pos = _c.value * seq.length;
          final i = pos.floor() % seq.length;
          // Hold each shape for 40% of its slot, then morph with the loop curve.
          final local = pos - pos.floor();
          final t = MaterialYouTokens.loop.transform(((local - 0.4) / 0.6).clamp(0.0, 1.0));
          final rot = widget.spin ? _c.value * 2 * math.pi * (widget.period.inMilliseconds / MaterialYouTokens.loopSpin.inMilliseconds) : 0.0;
          return CustomPaint(painter: _ShapePainter(seq[i], seq[(i + 1) % seq.length], t, rot, color), child: child);
        },
        child: widget.child == null ? null : Center(child: widget.child),
      ),
    );
  }
}

enum MuLoopKind { spin, float, wobble, breathe }

/// Wraps any widget in one of the theme's slow decorative loops.
class MuLoop extends StatefulWidget {
  const MuLoop({super.key, required this.kind, required this.child, this.reverse = false, this.phase = 0});
  final MuLoopKind kind;
  final Widget child;
  final bool reverse;

  /// 0..1 start offset so several stickers don't move in sync.
  final double phase;
  @override
  State<MuLoop> createState() => _MuLoopState();
}

class _MuLoopState extends State<MuLoop> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    value: widget.phase,
    duration: switch (widget.kind) {
      MuLoopKind.spin => MaterialYouTokens.loopSpin,
      MuLoopKind.float => MaterialYouTokens.loopFloat,
      MuLoopKind.wobble => MaterialYouTokens.loopWobble,
      MuLoopKind.breathe => MaterialYouTokens.loopBreathe,
    },
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _motionOff(context) ? _c.stop() : _c.repeat();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: _c,
        child: widget.child,
        builder: (context, child) {
          final v = widget.reverse ? 1 - _c.value : _c.value;
          final wave = math.sin(v * 2 * math.pi); // -1..1, smooth loop
          return switch (widget.kind) {
            MuLoopKind.spin => Transform.rotate(angle: v * 2 * math.pi, child: child),
            MuLoopKind.float => Transform.translate(offset: Offset(0, -8 * (wave + 1) / 2), child: child),
            MuLoopKind.wobble => Transform.rotate(angle: wave * 4 * math.pi / 180, child: child),
            MuLoopKind.breathe => Transform.scale(scale: 1 + 0.02 * (wave + 1), child: child),
          };
        },
      );
}

/// Soft brand-colour blobs drifting slowly behind a hero / header.
class MuDriftBackground extends StatefulWidget {
  const MuDriftBackground({super.key, required this.child, this.colors});
  final Widget child;
  final List<Color>? colors;
  @override
  State<MuDriftBackground> createState() => _MuDriftBackgroundState();
}

class _MuDriftBackgroundState extends State<MuDriftBackground> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: MaterialYouTokens.loopDrift);

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _motionOff(context) ? _c.stop() : _c.repeat();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final colors = widget.colors ??
        const [MaterialYouTokens.tomato, MaterialYouTokens.bubblegum, MaterialYouTokens.sky];
    return Stack(children: [
      Positioned.fill(
        child: AnimatedBuilder(
          animation: _c,
          builder: (context, _) => CustomPaint(painter: _DriftPainter(_c.value, colors, dark ? 0.28 : 0.5)),
        ),
      ),
      widget.child,
    ]);
  }
}

class _DriftPainter extends CustomPainter {
  _DriftPainter(this.v, this.colors, this.opacity);
  final double v, opacity;
  final List<Color> colors;
  static const _anchors = [Offset(0.15, 0.1), Offset(0.9, 0.45), Offset(0.45, 0.95)];
  @override
  void paint(Canvas canvas, Size s) {
    final r = s.shortestSide * 0.55;
    for (var i = 0; i < colors.length && i < 3; i++) {
      final ph = v * 2 * math.pi + i * 2.1;
      final c = Offset((_anchors[i].dx + 0.06 * math.sin(ph)) * s.width, (_anchors[i].dy + 0.07 * math.cos(ph)) * s.height);
      canvas.drawCircle(
        c,
        r * (1 + 0.06 * math.sin(ph * 2)),
        Paint()
          ..color = colors[i].withValues(alpha: opacity)
          ..maskFilter = MaskFilter.blur(BlurStyle.normal, r * 0.45),
      );
    }
  }

  @override
  bool shouldRepaint(_DriftPainter o) => o.v != v;
}

/// The board's signature block: a big name + hex on a duo colour.
class MuPaletteCard extends StatelessWidget {
  const MuPaletteCard({super.key, required this.duo, required this.title, this.subtitle});
  final List<Color> duo; // [background, foreground] — use MaterialYouTokens.duo*
  final String title;
  final String? subtitle;
  @override
  Widget build(BuildContext context) {
    final tt = Theme.of(context).textTheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      decoration: BoxDecoration(color: duo[0], borderRadius: BorderRadius.circular(MaterialYouTokens.radiusXl)),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Text(title, style: tt.headlineLarge?.copyWith(color: duo[1]), textAlign: TextAlign.center),
        if (subtitle != null)
          Text(subtitle!, style: tt.labelMedium?.copyWith(color: duo[1].withValues(alpha: 0.9), fontFamily: 'monospace')),
      ]),
    );
  }
}
