"""Initial schema migration

Revision ID: 0001_initial_schema
Revises: 
Create Date: 2026-10-01 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0001_initial_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Users Table
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('username', sa.String(length=50), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('passwordHash', sa.String(length=255), nullable=False),
        sa.Column('role', sa.String(length=20), server_default='STAFF', nullable=False),
        sa.Column('status', sa.String(length=20), server_default='PENDING', nullable=False),
        sa.Column('failedLogins', sa.Integer(), server_default='0', nullable=False),
        sa.Column('lockedUntil', sa.DateTime(timezone=True), nullable=True),
        sa.Column('createdAt', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updatedAt', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_users_id'), 'users', ['id'], unique=False)
    op.create_index(op.f('ix_users_username'), 'users', ['username'], unique=True)
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)

    # 2. Refresh Tokens Table
    op.create_table(
        'refresh_tokens',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('userId', sa.Integer(), nullable=False),
        sa.Column('tokenHash', sa.String(length=255), nullable=False),
        sa.Column('familyId', sa.String(length=100), nullable=False),
        sa.Column('expiresAt', sa.DateTime(timezone=True), nullable=False),
        sa.Column('revokedAt', sa.DateTime(timezone=True), nullable=True),
        sa.Column('userAgent', sa.String(length=255), nullable=True),
        sa.Column('ip', sa.String(length=45), nullable=True),
        sa.Column('createdAt', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['userId'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_refresh_tokens_id'), 'refresh_tokens', ['id'], unique=False)
    op.create_index(op.f('ix_refresh_tokens_userId'), 'refresh_tokens', ['userId'], unique=False)
    op.create_index(op.f('ix_refresh_tokens_tokenHash'), 'refresh_tokens', ['tokenHash'], unique=True)
    op.create_index(op.f('ix_refresh_tokens_familyId'), 'refresh_tokens', ['familyId'], unique=False)

    # 3. Categories Table
    op.create_table(
        'categories',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('isActive', sa.Boolean(), server_default='1', nullable=False),
        sa.Column('createdAt', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updatedAt', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_categories_id'), 'categories', ['id'], unique=False)
    op.create_index(op.f('ix_categories_name'), 'categories', ['name'], unique=True)

    # 4. Units Table
    op.create_table(
        'units',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=50), nullable=False),
        sa.Column('description', sa.String(length=100), nullable=True),
        sa.Column('allowDecimals', sa.Boolean(), server_default='0', nullable=False),
        sa.Column('isActive', sa.Boolean(), server_default='1', nullable=False),
        sa.Column('createdAt', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_units_id'), 'units', ['id'], unique=False)
    op.create_index(op.f('ix_units_name'), 'units', ['name'], unique=True)

    # 5. Locations Table
    op.create_table(
        'locations',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('isActive', sa.Boolean(), server_default='1', nullable=False),
        sa.Column('createdAt', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_locations_id'), 'locations', ['id'], unique=False)
    op.create_index(op.f('ix_locations_name'), 'locations', ['name'], unique=True)

    # 6. Items Table (with quantity >= 0 check constraint)
    op.create_table(
        'items',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('itemCode', sa.String(length=50), nullable=False),
        sa.Column('itemName', sa.String(length=200), nullable=False),
        sa.Column('barcode', sa.String(length=100), nullable=False),
        sa.Column('unitId', sa.Integer(), nullable=False),
        sa.Column('categoryId', sa.Integer(), nullable=False),
        sa.Column('quantity', sa.Numeric(precision=12, scale=2), server_default='0.00', nullable=False),
        sa.Column('minStockLevel', sa.Numeric(precision=12, scale=2), server_default='0.00', nullable=False),
        sa.Column('isActive', sa.Boolean(), server_default='1', nullable=False),
        sa.Column('createdBy', sa.Integer(), nullable=True),
        sa.Column('createdAt', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updatedAt', sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint('quantity >= 0', name='check_item_quantity_non_negative'),
        sa.ForeignKeyConstraint(['categoryId'], ['categories.id']),
        sa.ForeignKeyConstraint(['unitId'], ['units.id']),
        sa.ForeignKeyConstraint(['createdBy'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_items_id'), 'items', ['id'], unique=False)
    op.create_index(op.f('ix_items_itemCode'), 'items', ['itemCode'], unique=True)
    op.create_index(op.f('ix_items_itemName'), 'items', ['itemName'], unique=False)
    op.create_index(op.f('ix_items_barcode'), 'items', ['barcode'], unique=True)
    op.create_index(op.f('ix_items_categoryId'), 'items', ['categoryId'], unique=False)
    op.create_index(op.f('ix_items_isActive'), 'items', ['isActive'], unique=False)
    op.create_index(op.f('ix_items_createdAt'), 'items', ['createdAt'], unique=False)

    # 7. StockIn Table
    op.create_table(
        'stock_ins',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('itemId', sa.Integer(), nullable=False),
        sa.Column('quantity', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('remark', sa.String(length=500), nullable=True),
        sa.Column('createdBy', sa.Integer(), nullable=False),
        sa.Column('createdAt', sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint('quantity > 0', name='check_stock_in_quantity_positive'),
        sa.ForeignKeyConstraint(['itemId'], ['items.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['createdBy'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_stock_ins_id'), 'stock_ins', ['id'], unique=False)
    op.create_index(op.f('ix_stock_ins_itemId'), 'stock_ins', ['itemId'], unique=False)
    op.create_index(op.f('ix_stock_ins_createdAt'), 'stock_ins', ['createdAt'], unique=False)

    # 8. StockOut Table
    op.create_table(
        'stock_outs',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('itemId', sa.Integer(), nullable=False),
        sa.Column('quantity', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('location', sa.String(length=100), nullable=False),
        sa.Column('remark', sa.String(length=500), nullable=True),
        sa.Column('createdBy', sa.Integer(), nullable=False),
        sa.Column('createdAt', sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint('quantity > 0', name='check_stock_out_quantity_positive'),
        sa.ForeignKeyConstraint(['itemId'], ['items.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['createdBy'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_stock_outs_id'), 'stock_outs', ['id'], unique=False)
    op.create_index(op.f('ix_stock_outs_itemId'), 'stock_outs', ['itemId'], unique=False)
    op.create_index(op.f('ix_stock_outs_createdAt'), 'stock_outs', ['createdAt'], unique=False)

    # 9. StockMovement Ledger Table
    op.create_table(
        'stock_movements',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('itemId', sa.Integer(), nullable=False),
        sa.Column('type', sa.String(length=20), nullable=False),
        sa.Column('quantity', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('balanceAfter', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('referenceId', sa.String(length=100), nullable=True),
        sa.Column('createdBy', sa.Integer(), nullable=True),
        sa.Column('createdAt', sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint('"balanceAfter" >= 0', name='check_movement_balance_non_negative'),
        sa.ForeignKeyConstraint(['itemId'], ['items.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['createdBy'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_stock_movements_id'), 'stock_movements', ['id'], unique=False)
    op.create_index(op.f('ix_stock_movements_itemId'), 'stock_movements', ['itemId'], unique=False)
    op.create_index(op.f('ix_stock_movements_createdAt'), 'stock_movements', ['createdAt'], unique=False)

    # 10. AuditLog Table
    op.create_table(
        'audit_logs',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('userId', sa.Integer(), nullable=True),
        sa.Column('action', sa.String(length=50), nullable=False),
        sa.Column('entity', sa.String(length=50), nullable=False),
        sa.Column('entityId', sa.String(length=50), nullable=True),
        sa.Column('oldValue', sa.JSON(), nullable=True),
        sa.Column('newValue', sa.JSON(), nullable=True),
        sa.Column('ip', sa.String(length=45), nullable=True),
        sa.Column('userAgent', sa.String(length=255), nullable=True),
        sa.Column('createdAt', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['userId'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_audit_logs_id'), 'audit_logs', ['id'], unique=False)
    op.create_index(op.f('ix_audit_logs_userId'), 'audit_logs', ['userId'], unique=False)
    op.create_index(op.f('ix_audit_logs_action'), 'audit_logs', ['action'], unique=False)
    op.create_index(op.f('ix_audit_logs_entity'), 'audit_logs', ['entity'], unique=False)
    op.create_index(op.f('ix_audit_logs_entityId'), 'audit_logs', ['entityId'], unique=False)
    op.create_index(op.f('ix_audit_logs_createdAt'), 'audit_logs', ['createdAt'], unique=False)


def downgrade() -> None:
    op.drop_table('audit_logs')
    op.drop_table('stock_movements')
    op.drop_table('stock_outs')
    op.drop_table('stock_ins')
    op.drop_table('items')
    op.drop_table('locations')
    op.drop_table('units')
    op.drop_table('categories')
    op.drop_table('refresh_tokens')
    op.drop_table('users')
