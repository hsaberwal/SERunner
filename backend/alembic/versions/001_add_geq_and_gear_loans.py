"""Add GEQ cuts to locations and gear loans table

Revision ID: 001_add_geq_and_gear_loans
Revises:
Create Date: 2026-01-11

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

# revision identifiers, used by Alembic.
revision = '001_add_geq_and_gear_loans'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add GEQ cuts columns to locations table
    op.add_column('locations', sa.Column('lr_geq_cuts', JSONB, nullable=True))
    op.add_column('locations', sa.Column('monitor_geq_cuts', JSONB, nullable=True))
    op.add_column('locations', sa.Column('room_notes', sa.Text(), nullable=True))

    # Add new columns to gear table
    op.add_column('gear', sa.Column('serial_number', sa.String(), nullable=True))
    op.add_column('gear', sa.Column('quantity', sa.Integer(), server_default='1', nullable=False))
    op.add_column('gear', sa.Column('notes', sa.Text(), nullable=True))

    # Create gear_loans table
    op.create_table(
        'gear_loans',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('gear_id', UUID(as_uuid=True), sa.ForeignKey('gear.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('borrower_name', sa.String(), nullable=False),
        sa.Column('borrower_contact', sa.String(), nullable=True),
        sa.Column('quantity_loaned', sa.Integer(), default=1, nullable=False),
        sa.Column('loan_date', sa.DateTime(), nullable=False),
        sa.Column('expected_return_date', sa.DateTime(), nullable=True),
        sa.Column('actual_return_date', sa.DateTime(), nullable=True),
        sa.Column('is_returned', sa.Boolean(), default=False, nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('return_notes', sa.Text(), nullable=True),
    )

    # Create indexes for gear_loans
    op.create_index('ix_gear_loans_gear_id', 'gear_loans', ['gear_id'])
    op.create_index('ix_gear_loans_user_id', 'gear_loans', ['user_id'])
    op.create_index('ix_gear_loans_is_returned', 'gear_loans', ['is_returned'])


def downgrade() -> None:
    # Drop gear_loans table and indexes
    op.drop_index('ix_gear_loans_is_returned', table_name='gear_loans')
    op.drop_index('ix_gear_loans_user_id', table_name='gear_loans')
    op.drop_index('ix_gear_loans_gear_id', table_name='gear_loans')
    op.drop_table('gear_loans')

    # Remove new columns from gear table
    op.drop_column('gear', 'notes')
    op.drop_column('gear', 'quantity')
    op.drop_column('gear', 'serial_number')

    # Remove GEQ cuts columns from locations table
    op.drop_column('locations', 'room_notes')
    op.drop_column('locations', 'monitor_geq_cuts')
    op.drop_column('locations', 'lr_geq_cuts')
