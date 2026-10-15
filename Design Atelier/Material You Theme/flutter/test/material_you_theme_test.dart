import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:YOUR_APP/theme/material_you_theme.dart';
import 'package:YOUR_APP/theme/material_you_tokens.dart';

Widget app(ThemeData t, {bool noMotion = false}) => MediaQuery(
  data: MediaQueryData(disableAnimations: noMotion),
  child: MaterialApp(theme: t, home: Scaffold(body: MuDriftBackground(child: SingleChildScrollView(child: Column(children: [
    const MuMorphShape(),
    for (final s in MaterialYouTokens.shapes.keys) MuShape(s, size: 40),
    const MuLoop(kind: MuLoopKind.spin, child: Text('spin')),
    const MuLoop(kind: MuLoopKind.float, phase: .3, child: Text('float')),
    const MuLoop(kind: MuLoopKind.wobble, child: Text('wobble')),
    const MuLoop(kind: MuLoopKind.breathe, child: Text('breathe')),
    MuPaletteCard(duo: MaterialYouTokens.duoTomatoCream, title: 'Tomato', subtitle: '#F24E1E'),
    FilledButton(onPressed: () {}, child: const Text('Save')),
    ClipPath(clipper: const MuShapeClipper('clover'), child: Container(width: 40, height: 40, color: Colors.green)),
  ]))))));

void main() {
  for (final t in [MaterialYouTheme.light(), MaterialYouTheme.dark()]) {
    testWidgets('renders and loops (${t.brightness})', (tester) async {
      await tester.pumpWidget(app(t));
      for (var i = 0; i < 30; i++) { await tester.pump(const Duration(milliseconds: 400)); }
      expect(tester.takeException(), isNull);
      expect(find.text('Tomato'), findsOneWidget);
    });
  }
  testWidgets('reduced motion stops loops', (tester) async {
    await tester.pumpWidget(app(MaterialYouTheme.light(), noMotion: true));
    await tester.pump(const Duration(seconds: 1));
    expect(tester.hasRunningAnimations, isFalse);
  });
  test('all shapes have same sample count (morphable)', () {
    final n = MaterialYouTokens.shapes.values.map((v) => v.length).toSet();
    expect(n.length, 1);
  });
}
