"""Add stock batches, nepali/english dates, and pricing fields to stock transactions

Revision ID: 0002_stock_batches_extended
Revises: 0001_initial_schema
Create Date: 2026-10-05 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0002_stock_batches_extended'
down_revision: Union[str, None] = '0001_initial_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    dialect_name = bind.dialect.name

    # 1. stock_ins columns
    stock_in_cols = {col['name'] for col in insp.get_columns('stock_ins')}
    stock_in_cols_lower = {name.lower(): name for name in stock_in_cols}

    new_stock_in_columns = [
        ('dateAD', sa.String(length=20), None),
        ('dateBS', sa.String(length=20), None),
        ('supplierName', sa.String(length=200), None),
        ('receivedFrom', sa.String(length=200), None),
        ('location', sa.String(length=100), None),
        ('unitPrice', sa.Numeric(precision=12, scale=2), '0.00'),
        ('amount', sa.Numeric(precision=14, scale=2), '0.00'),
        ('batchNo', sa.String(length=100), None),
        ('mfgDate', sa.String(length=50), None),
        ('expiryDate', sa.String(length=50), None),
    ]

    for col_name, col_type, default in new_stock_in_columns:
        if dialect_name != 'sqlite' and col_name.lower() in stock_in_cols_lower and col_name not in stock_in_cols:
            existing = stock_in_cols_lower[col_name.lower()]
            bind.execute(sa.text(f'ALTER TABLE stock_ins RENAME COLUMN "{existing}" TO "{col_name}"'))
            stock_in_cols.add(col_name)
        elif col_name not in stock_in_cols:
            kwargs = {'server_default': default} if default else {}
            op.add_column('stock_ins', sa.Column(col_name, col_type, nullable=True, **kwargs))
            stock_in_cols.add(col_name)

    # 2. stock_outs columns
    stock_out_cols = {col['name'] for col in insp.get_columns('stock_outs')}
    stock_out_cols_lower = {name.lower(): name for name in stock_out_cols}

    new_stock_out_columns = [
        ('dateAD', sa.String(length=20), None),
        ('dateBS', sa.String(length=20), None),
        ('receiverName', sa.String(length=200), None),
        ('unitPrice', sa.Numeric(precision=12, scale=2), '0.00'),
        ('amount', sa.Numeric(precision=14, scale=2), '0.00'),
        ('batchNo', sa.String(length=100), None),
    ]

    for col_name, col_type, default in new_stock_out_columns:
        if dialect_name != 'sqlite' and col_name.lower() in stock_out_cols_lower and col_name not in stock_out_cols:
            existing = stock_out_cols_lower[col_name.lower()]
            bind.execute(sa.text(f'ALTER TABLE stock_outs RENAME COLUMN "{existing}" TO "{col_name}"'))
            stock_out_cols.add(col_name)
        elif col_name not in stock_out_cols:
            kwargs = {'server_default': default} if default else {}
            op.add_column('stock_outs', sa.Column(col_name, col_type, nullable=True, **kwargs))
            stock_out_cols.add(col_name)

    # 3. item_batches table
    table_names = insp.get_table_names()
    if 'item_batches' not in table_names:
        op.create_table(
            'item_batches',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('itemId', sa.Integer(), nullable=False),
            sa.Column('batchNo', sa.String(length=100), nullable=False),
            sa.Column('mfgDate', sa.String(length=50), nullable=True),
            sa.Column('expiryDate', sa.String(length=50), nullable=True),
            sa.Column('quantity', sa.Numeric(precision=12, scale=2), server_default='0.00', nullable=False),
            sa.Column('initialQuantity', sa.Numeric(precision=12, scale=2), server_default='0.00', nullable=False),
            sa.Column('unitPrice', sa.Numeric(precision=12, scale=2), server_default='0.00', nullable=True),
            sa.Column('supplierName', sa.String(length=200), nullable=True),
            sa.Column('createdAt', sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(['itemId'], ['items.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index(op.f('ix_item_batches_id'), 'item_batches', ['id'], unique=False)
        op.create_index(op.f('ix_item_batches_itemId'), 'item_batches', ['itemId'], unique=False)
        op.create_index(op.f('ix_item_batches_batchNo'), 'item_batches', ['batchNo'], unique=False)
        op.create_index(op.f('ix_item_batches_createdAt'), 'item_batches', ['createdAt'], unique=False)


def downgrade() -> None:
    # Downgrade logic if needed
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if 'item_batches' in insp.get_table_names():
        op.drop_table('item_batches')
