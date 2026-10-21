import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/domain.dart';
import 'contacts_cubit.dart';

class ContactsScreen extends StatelessWidget {
  const ContactsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;

    return BlocBuilder<ContactsCubit, List<EmergencyContact>>(
      builder: (context, contacts) {
        final cubit = context.read<ContactsCubit>();
        return Scaffold(
          appBar: AppBar(
            title: Text('Emergency contacts (${contacts.length}/${EmergencyContact.maxContacts})'),
          ),
          floatingActionButton: cubit.isFull
              ? null
              : FloatingActionButton.extended(
                  icon: const Icon(Icons.person_add_alt_1),
                  label: const Text('Add contact'),
                  onPressed: () => _ContactDialog.show(context),
                ),
          body: contacts.isEmpty
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(32),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.contacts_outlined, size: 64, color: scheme.outline),
                        const SizedBox(height: 16),
                        Text('No emergency contacts yet', style: text.titleMedium),
                        const SizedBox(height: 8),
                        Text(
                          'Add at least one person who should be told if you '
                          'have an accident.',
                          textAlign: TextAlign.center,
                          style: text.bodyMedium?.copyWith(color: scheme.onSurfaceVariant),
                        ),
                      ],
                    ),
                  ),
                )
              : Column(
                  children: [
                    Padding(
                      padding: const EdgeInsets.fromLTRB(20, 4, 20, 8),
                      child: Text(
                        'Drag to change the order. #1 is contacted first.',
                        style: text.bodySmall?.copyWith(color: scheme.onSurfaceVariant),
                      ),
                    ),
                    Expanded(
                      child: ReorderableListView.builder(
                        padding: const EdgeInsets.only(bottom: 96),
                        itemCount: contacts.length,
                        buildDefaultDragHandles: false,
                        onReorder: cubit.reorder,
                        itemBuilder: (context, i) {
                          final c = contacts[i];
                          return ListTile(
                            key: ValueKey(c.id),
                            leading: CircleAvatar(child: Text('${c.priority}')),
                            title: Text(c.name),
                            subtitle: Text(c.phone),
                            onTap: () => _ContactDialog.show(context, existing: c),
                            trailing: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                IconButton(
                                  tooltip: 'Remove',
                                  icon: const Icon(Icons.delete_outline),
                                  onPressed: () => _confirmRemove(context, c),
                                ),
                                ReorderableDragStartListener(
                                  index: i,
                                  child: const Padding(
                                    padding: EdgeInsets.all(8),
                                    child: Icon(Icons.drag_handle),
                                  ),
                                ),
                              ],
                            ),
                          );
                        },
                      ),
                    ),
                  ],
                ),
        );
      },
    );
  }

  Future<void> _confirmRemove(BuildContext context, EmergencyContact c) async {
    final cubit = context.read<ContactsCubit>();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Remove ${c.name}?'),
        content: const Text('They will no longer be alerted after an accident.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Remove')),
        ],
      ),
    );
    if (ok == true) await cubit.remove(c.id);
  }
}

/// Add / edit dialog with inline validation.
class _ContactDialog extends StatefulWidget {
  const _ContactDialog({required this.cubit, this.existing});

  final ContactsCubit cubit;
  final EmergencyContact? existing;

  static Future<void> show(BuildContext context, {EmergencyContact? existing}) {
    final cubit = context.read<ContactsCubit>();
    return showDialog<void>(
      context: context,
      builder: (_) => _ContactDialog(cubit: cubit, existing: existing),
    );
  }

  @override
  State<_ContactDialog> createState() => _ContactDialogState();
}

class _ContactDialogState extends State<_ContactDialog> {
  late final _name = TextEditingController(text: widget.existing?.name);
  late final _phone = TextEditingController(text: widget.existing?.phone);
  String? _error;
  bool _saving = false;

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    final e = widget.existing;
    final error = e == null
        ? await widget.cubit.add(_name.text, _phone.text)
        : await widget.cubit.edit(e.id, _name.text, _phone.text);
    if (!mounted) return;
    if (error == null) {
      Navigator.of(context).pop();
    } else {
      setState(() {
        _error = error;
        _saving = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.existing == null ? 'Add contact' : 'Edit contact'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            controller: _name,
            autofocus: true,
            textCapitalization: TextCapitalization.words,
            decoration: const InputDecoration(labelText: 'Name'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _phone,
            keyboardType: TextInputType.phone,
            decoration: const InputDecoration(
              labelText: 'Phone',
              hintText: '01xxxxxxxxx or +20…',
            ),
            onSubmitted: (_) => _save(),
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
          ],
        ],
      ),
      actions: [
        TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Cancel')),
        FilledButton(onPressed: _saving ? null : _save, child: const Text('Save')),
      ],
    );
  }
}
